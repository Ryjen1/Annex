// SPDX-License-Identifier: MIT
import { useState } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'

import {
  computeLiquidationPrice,
  computeProjectedICR,
  findTroveHints,
  useTrove,
} from '../hooks/useTrove'
import { borrowerOperationsAbi } from '../lib/mezoAbi'
import { BORROWER_OPERATIONS_ADDRESS, MEZO_FAUCET_URL, TROVE_MANAGER_ADDRESS } from '../lib/contracts'
import { explorerAddress, explorerTx } from '../lib/chains'
import {
  formatBtc,
  formatMusd,
  formatRatioPct,
  formatUsdPrice,
  parseDecimalInput,
} from '../lib/format'
import { BitcoinIcon, CheckIcon, ExternalIcon, ShieldIcon } from './icons'

const WAD = 10n ** 18n

type TroveFundingPanelProps = {
  /** Pre-fill MUSD amount needed by a parent Trade/Create flow */
  suggestedMusd?: string
  compact?: boolean
  onFunded?: () => void
}

export function TroveFundingPanel({
  suggestedMusd,
  compact = false,
  onFunded,
}: TroveFundingPanelProps) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const trove = useTrove(address)
  const txWrite = useWriteContract()

  const [btcDraft, setBtcDraft] = useState<string | null>(null)
  const [borrowDraft, setBorrowDraft] = useState<string | null>(null)
  const [busyStep, setBusyStep] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    tone: 'ok' | 'error'
    text: string
    hash?: `0x${string}`
  } | null>(null)

  const minMusd = Number(trove.minNetDebt / WAD) || 1800
  const defaultBorrow = trove.isActive
    ? suggestedMusd && Number(suggestedMusd) > 0
      ? suggestedMusd
      : '100'
    : String(Math.ceil(suggestedMusd ? Math.max(Number(suggestedMusd), minMusd) : minMusd))

  const btcInput = btcDraft ?? (trove.isActive ? '0' : '0.06')
  const borrowInput = borrowDraft ?? defaultBorrow

  const setBtcInput = (v: string) => setBtcDraft(v)
  const setBorrowInput = (v: string) => setBorrowDraft(v)

  const collInputWei = parseDecimalInput(btcInput)
  const borrowWei = parseDecimalInput(borrowInput)

  const borrowFee = borrowWei > 0n ? (borrowWei * trove.borrowingRate) / WAD : 0n
  const requiredRatio = trove.isRecoveryMode ? trove.ccr : trove.mcr

  // Projected post-tx state
  const projectedColl = trove.isActive ? trove.coll + collInputWei : collInputWei
  const projectedDebt = trove.isActive
    ? trove.debt + borrowWei + borrowFee
    : borrowWei + borrowFee + (borrowWei > 0n ? trove.gasCompensation : 0n)

  const projectedIcr =
    projectedDebt > 0n && trove.btcPrice > 0n
      ? computeProjectedICR(projectedColl, projectedDebt, trove.btcPrice)
      : 0n

  const projectedLiqPrice =
    projectedColl > 0n && projectedDebt > 0n
      ? computeLiquidationPrice(projectedColl, projectedDebt, trove.mcr)
      : 0n

  // Maximum theoretical borrowing capacity with projected collateral at MCR
  const maxDebtFromColl =
    trove.btcPrice > 0n && trove.mcr > 0n
      ? (projectedColl * trove.btcPrice) / trove.mcr
      : 0n

  const needsRefinanceForBorrow =
    trove.isActive &&
    borrowWei > 0n &&
    projectedDebt > trove.maxBorrowingCapacity &&
    projectedDebt <= maxDebtFromColl

  // Validation
  const insufficientBtc = collInputWei > trove.btcBalance
  const belowMinDebt = !trove.isActive && borrowWei > 0n && borrowWei < trove.minNetDebt
  const icrTooLow =
    projectedIcr > 0n && requiredRatio > 0n && projectedIcr < requiredRatio
  const emptyAction = trove.isActive
    ? collInputWei === 0n && borrowWei === 0n
    : collInputWei === 0n || borrowWei === 0n

  const canSubmit =
    isConnected &&
    !busyStep &&
    !emptyAction &&
    !insufficientBtc &&
    !belowMinDebt &&
    !icrTooLow &&
    (!trove.isActive || borrowWei === 0n || projectedDebt <= maxDebtFromColl || trove.btcPrice === 0n)

  async function handleSubmit() {
    if (!address || !publicClient) return
    setFeedback(null)
    try {
      let lastHash: `0x${string}` | undefined

      if (!trove.isActive) {
        setBusyStep('Computing trove hints & opening Trove…')
        const [upperHint, lowerHint] = await findTroveHints(
          publicClient,
          collInputWei,
          borrowWei + borrowFee,
        )
        const hash = await txWrite.writeContractAsync({
          address: BORROWER_OPERATIONS_ADDRESS,
          abi: borrowerOperationsAbi,
          functionName: 'openTrove',
          args: [borrowWei, upperHint, lowerHint],
          value: collInputWei,
        })
        lastHash = hash
        await publicClient.waitForTransactionReceipt({ hash })
        setFeedback({
          tone: 'ok',
          text: `Opened Trove and minted ${formatMusd(borrowWei, 0)} MUSD`,
          hash: lastHash,
        })
      } else if (collInputWei > 0n && borrowWei === 0n) {
        setBusyStep('Adding BTC collateral to Trove…')
        const [upperHint, lowerHint] = await findTroveHints(
          publicClient,
          projectedColl,
          trove.debt,
        )
        const hash = await txWrite.writeContractAsync({
          address: BORROWER_OPERATIONS_ADDRESS,
          abi: borrowerOperationsAbi,
          functionName: 'addColl',
          args: [upperHint, lowerHint],
          value: collInputWei,
        })
        lastHash = hash
        await publicClient.waitForTransactionReceipt({ hash })
        setFeedback({
          tone: 'ok',
          text: `Added ${formatBtc(collInputWei)} BTC collateral to your Trove`,
          hash: lastHash,
        })
      } else if (needsRefinanceForBorrow) {
        if (collInputWei > 0n) {
          setBusyStep('Step 1/3: Adding BTC collateral…')
          const [u1, l1] = await findTroveHints(publicClient, projectedColl, trove.debt)
          const h1 = await txWrite.writeContractAsync({
            address: BORROWER_OPERATIONS_ADDRESS,
            abi: borrowerOperationsAbi,
            functionName: 'addColl',
            args: [u1, l1],
            value: collInputWei,
          })
          await publicClient.waitForTransactionReceipt({ hash: h1 })
        }

        setBusyStep(collInputWei > 0n ? 'Step 2/3: Refinancing Trove borrow cap…' : 'Step 1/2: Refinancing Trove borrow cap…')
        const [u2, l2] = await findTroveHints(publicClient, projectedColl, trove.debt)
        const h2 = await txWrite.writeContractAsync({
          address: BORROWER_OPERATIONS_ADDRESS,
          abi: borrowerOperationsAbi,
          functionName: 'refinance',
          args: [u2, l2],
        })
        await publicClient.waitForTransactionReceipt({ hash: h2 })

        setBusyStep(collInputWei > 0n ? 'Step 3/3: Minting MUSD from Trove…' : 'Step 2/2: Minting MUSD from Trove…')
        const [u3, l3] = await findTroveHints(publicClient, projectedColl, projectedDebt)
        const h3 = await txWrite.writeContractAsync({
          address: BORROWER_OPERATIONS_ADDRESS,
          abi: borrowerOperationsAbi,
          functionName: 'withdrawMUSD',
          args: [borrowWei, u3, l3],
        })
        lastHash = h3
        await publicClient.waitForTransactionReceipt({ hash: h3 })
        setFeedback({
          tone: 'ok',
          text: `Topped up Trove & minted ${formatMusd(borrowWei, 2)} MUSD`,
          hash: lastHash,
        })
      } else {
        setBusyStep('Topping up Trove & minting MUSD…')
        const [upperHint, lowerHint] = await findTroveHints(
          publicClient,
          projectedColl,
          projectedDebt,
        )
        const hash = await txWrite.writeContractAsync({
          address: BORROWER_OPERATIONS_ADDRESS,
          abi: borrowerOperationsAbi,
          functionName: 'adjustTrove',
          args: [0n, borrowWei, true, upperHint, lowerHint],
          value: collInputWei,
        })
        lastHash = hash
        await publicClient.waitForTransactionReceipt({ hash })
        setFeedback({
          tone: 'ok',
          text: `Topped up Trove & minted ${formatMusd(borrowWei, 2)} MUSD`,
          hash: lastHash,
        })
      }

      setBtcDraft(null)
      setBorrowDraft(null)
      trove.refetch()
      onFunded?.()
    } catch (error) {
      setFeedback({ tone: 'error', text: shortenTroveError(error) })
    } finally {
      setBusyStep(null)
    }
  }

  return (
    <div
      className={`rounded-3xl border border-annex-orange/25 bg-[#0a0b1c]/95 ${
        compact ? 'p-4' : 'glass p-6 sm:p-8'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-annex-orange/15 text-annex-orange">
            <BitcoinIcon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-sm font-semibold text-white">
              {trove.isActive ? 'Top Up Mezo Trove' : 'Open Mezo Trove (BTC → MUSD)'}
            </h3>
            <p className="text-[11px] text-white/45">
              Powered by Mezo BorrowerOperations &amp; TroveManager
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-white/45">
          <span>BTC/USD</span>
          <span className="font-mono font-semibold text-annex-orange-soft">
            {formatUsdPrice(trove.btcPrice)}
          </span>
        </div>
      </div>

      {/* Live Trove State from TroveManager + PriceFeed */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Metric
          label="Trove Coll"
          value={trove.isActive ? `${formatBtc(trove.coll)} BTC` : 'No Trove'}
        />
        <Metric
          label="Trove Debt"
          value={trove.isActive ? `${formatMusd(trove.debt, 0)} MUSD` : '0 MUSD'}
        />
        <Metric
          label="Collateral Ratio"
          value={trove.isActive ? formatRatioPct(trove.icr) : '—'}
          tone={
            !trove.isActive
              ? undefined
              : trove.icr >= trove.ccr
                ? 'green'
                : trove.icr >= trove.mcr
                  ? 'orange'
                  : 'red'
          }
        />
        <Metric
          label="Liquidation Price"
          value={trove.isActive ? formatUsdPrice(trove.liquidationPrice) : '—'}
          tone={trove.isActive ? 'orange' : undefined}
        />
      </div>

      {trove.isActive && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/6 bg-white/[0.02] px-3 py-2 text-[11px] text-white/50">
          <span>
            Remaining borrow cap:{' '}
            <strong className="font-mono text-white">
              {formatMusd(trove.availableToBorrow, 0)} MUSD
            </strong>{' '}
            (max {formatMusd(trove.maxBorrowingCapacity, 0)})
          </span>
          <a
            href={explorerAddress(TROVE_MANAGER_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-annex-orange hover:underline"
          >
            TroveManager <ExternalIcon className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Balances + Faucet helper */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-white/50">
        <span>
          Wallet: <strong className="font-mono text-white">{formatBtc(trove.btcBalance)} BTC</strong> ·{' '}
          <strong className="font-mono text-white">{formatMusd(trove.musdBalance)} MUSD</strong>
        </span>
        <a
          href={MEZO_FAUCET_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-annex-orange hover:underline"
        >
          Get testnet BTC <ExternalIcon className="h-3 w-3" />
        </a>
      </div>

      {/* Inputs */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label-caps mb-1.5 block" htmlFor="trove-btc">
            {trove.isActive ? 'Add BTC collateral' : 'BTC collateral'}
          </label>
          <div className="relative">
            <input
              id="trove-btc"
              type="number"
              min="0"
              step="0.005"
              value={btcInput}
              onChange={(e) => setBtcInput(e.target.value)}
              className="input-field focus:input-field-focus pr-14 font-mono text-sm tabular-nums"
              placeholder="0.05"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-white/45">
              BTC
            </span>
          </div>
        </div>

        <div>
          <label className="label-caps mb-1.5 block" htmlFor="trove-musd">
            {trove.isActive ? 'Borrow MUSD' : 'Mint MUSD (min 1,800)'}
          </label>
          <div className="relative">
            <input
              id="trove-musd"
              type="number"
              min="0"
              step="10"
              value={borrowInput}
              onChange={(e) => setBorrowInput(e.target.value)}
              className="input-field focus:input-field-focus pr-14 font-mono text-sm tabular-nums"
              placeholder="1800"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-white/45">
              MUSD
            </span>
          </div>
        </div>
      </div>

      {/* Live Preview After Operation */}
      {(collInputWei > 0n || borrowWei > 0n) && (
        <dl className="mt-4 space-y-1.5 rounded-2xl border border-white/6 bg-white/[0.02] p-3 text-xs">
          <PreviewRow label="Resulting Trove Coll" value={`${formatBtc(projectedColl)} BTC`} />
          <PreviewRow
            label="Resulting Trove Debt"
            value={`${formatMusd(projectedDebt, 2)} MUSD`}
          />
          <PreviewRow
            label="Projected ICR"
            value={`${formatRatioPct(projectedIcr)} (min ${formatRatioPct(requiredRatio)})`}
            highlight={icrTooLow ? 'red' : 'green'}
          />
          <PreviewRow
            label="Projected Liquidation Price"
            value={formatUsdPrice(projectedLiqPrice)}
          />
          {!trove.isActive && borrowWei > 0n && (
            <PreviewRow
              label="Includes fee + gas reserve"
              value={`${formatMusd(borrowFee, 2)} + ${formatMusd(trove.gasCompensation, 0)} MUSD`}
            />
          )}
        </dl>
      )}

      {/* Guardrails & Guidance */}
      {insufficientBtc && (
        <p className="mt-3 text-xs text-annex-red">
          Not enough native BTC for collateral + gas. Request testnet BTC from{' '}
          <a
            href={MEZO_FAUCET_URL}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            faucet.test.mezo.org
          </a>
          .
        </p>
      )}
      {belowMinDebt && (
        <p className="mt-3 text-xs text-annex-red">
          Mezo requires at least {formatMusd(trove.minNetDebt, 0)} MUSD net debt to open a new Trove.
        </p>
      )}
      {icrTooLow && (
        <p className="mt-3 text-xs text-annex-red">
          Collateral ratio would fall below {formatRatioPct(requiredRatio)}. Add more BTC or borrow less MUSD.
        </p>
      )}
      {needsRefinanceForBorrow && !icrTooLow && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-annex-orange-soft">
          <ShieldIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Additional borrow exceeds recorded capacity ({formatMusd(trove.maxBorrowingCapacity, 0)} MUSD). Annex will{' '}
            {collInputWei > 0n ? 'add BTC collateral, ' : ''}refinance capacity against live collateral, and mint MUSD.
          </span>
        </p>
      )}

      {feedback && (
        <div
          className={`mt-3 flex items-start justify-between gap-2 rounded-2xl border px-3 py-2 text-xs ${
            feedback.tone === 'ok'
              ? 'border-annex-green/35 bg-annex-green/10 text-annex-green'
              : 'border-annex-red/35 bg-annex-red/10 text-annex-red'
          }`}
        >
          <span className="flex items-start gap-1.5">
            {feedback.tone === 'ok' && <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            <span>{feedback.text}</span>
          </span>
          {feedback.hash && (
            <a
              href={explorerTx(feedback.hash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1 underline"
            >
              Tx <ExternalIcon className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="btn-primary btn-primary-hover mt-4 w-full px-4 py-3 text-sm"
      >
        {!isConnected
          ? 'Connect wallet to manage Trove'
          : busyStep
            ? busyStep
            : !trove.isActive
              ? `Deposit ${formatBtc(collInputWei, 3)} BTC & Mint ${formatMusd(borrowWei, 0)} MUSD`
              : borrowWei > 0n
                ? `Top Up Trove & Mint ${formatMusd(borrowWei, 0)} MUSD`
                : `Add ${formatBtc(collInputWei, 3)} BTC Collateral`}
      </button>
    </div>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'green' | 'orange' | 'red'
}) {
  const toneClass =
    tone === 'green'
      ? 'text-annex-green'
      : tone === 'orange'
        ? 'text-annex-orange-soft'
        : tone === 'red'
          ? 'text-annex-red'
          : 'text-white'

  return (
    <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-2.5">
      <div className="label-caps text-[9px]">{label}</div>
      <div className={`mt-1 font-mono text-xs font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  )
}

function PreviewRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: 'green' | 'red'
}) {
  const color =
    highlight === 'green'
      ? 'text-annex-green font-semibold'
      : highlight === 'red'
        ? 'text-annex-red font-semibold'
        : 'text-white'

  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-white/45">{label}</dt>
      <dd className={`font-mono tabular-nums ${color}`}>{value}</dd>
    </div>
  )
}

function shortenTroveError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('User rejected')) return 'Transaction rejected'
  if (message.includes('maxBorrowingCapacity')) return 'Exceeds Trove borrowing capacity — refinance first'
  if (message.includes('MCR') || message.includes('CCR')) return 'Collateral ratio too low'
  if (message.includes('minNetDebt') || message.includes('net debt')) return 'Minimum net debt is 1,800 MUSD'
  if (message.includes('insufficient funds')) return 'Insufficient native BTC for collateral + gas'
  return message.split('\n')[0].slice(0, 140)
}
