import {type AsyncResult, isComplete} from "@attio/fetchable"

import {isCustomerNotFoundError} from "./client/customer-not-found"
import type {ProductboardClientError} from "./client/productboard-client"
import {productboardClient} from "./index"

const EVENTUAL_CONSISTENCY_BASE_DELAY_MS = 1000
const EVENTUAL_CONSISTENCY_MAX_TOTAL_DELAY_MS = 25_000

export const DEFAULT_FIXED_LINK_RETRY = {
    intervalMs: 1000,
    maxDurationMs: 20_000,
} as const

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function computeEventualConsistencyDelayMs(attempt: number, elapsedMs: number): number {
    const remainingMs = EVENTUAL_CONSISTENCY_MAX_TOTAL_DELAY_MS - elapsedMs
    if (remainingMs <= 0) return 0

    return Math.min(EVENTUAL_CONSISTENCY_BASE_DELAY_MS * 2 ** attempt, remainingMs)
}

async function retryLinkWithFixedInterval({
    link,
    intervalMs,
    maxDurationMs,
}: {
    link: () => AsyncResult<void, ProductboardClientError>
    intervalMs: number
    maxDurationMs: number
}): AsyncResult<void, ProductboardClientError> {
    const startedAt = Date.now()

    let result = await link()
    if (isComplete(result) || !isCustomerNotFoundError(result.error)) {
        return result
    }

    while (Date.now() - startedAt < maxDurationMs) {
        await sleep(intervalMs)

        result = await link()
        if (isComplete(result) || !isCustomerNotFoundError(result.error)) {
            return result
        }
    }

    return result
}

export default async function linkProductboardNoteCustomer({
    noteId,
    customerEmail,
    allowEventualConsistencyRetry = false,
    fixedIntervalRetry,
}: {
    noteId: string
    customerEmail: string
    allowEventualConsistencyRetry?: boolean
    fixedIntervalRetry?: {
        intervalMs: number
        maxDurationMs: number
    }
}): AsyncResult<void, ProductboardClientError> {
    const link = () => productboardClient.notes.linkCustomer({noteId, customerEmail})

    if (fixedIntervalRetry) {
        return retryLinkWithFixedInterval({
            link,
            intervalMs: fixedIntervalRetry.intervalMs,
            maxDurationMs: fixedIntervalRetry.maxDurationMs,
        })
    }

    let result = await link()
    if (
        isComplete(result) ||
        !allowEventualConsistencyRetry ||
        !isCustomerNotFoundError(result.error)
    ) {
        return result
    }

    let elapsedMs = 0
    let attempt = 0

    while (elapsedMs < EVENTUAL_CONSISTENCY_MAX_TOTAL_DELAY_MS) {
        const delayMs = computeEventualConsistencyDelayMs(attempt, elapsedMs)
        if (delayMs <= 0) break

        await sleep(delayMs)
        elapsedMs += delayMs
        attempt += 1

        result = await link()
        if (isComplete(result) || !isCustomerNotFoundError(result.error)) {
            return result
        }
    }

    return result
}
