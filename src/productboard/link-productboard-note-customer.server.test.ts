import {complete, errored, isComplete} from "@attio/fetchable"
import {beforeEach, describe, expect, it, vi} from "vitest"

import {ProductboardClientErrorCode} from "./client/productboard-client"

vi.mock("./index", () => ({
    productboardClient: {
        notes: {
            linkCustomer: vi.fn(),
        },
    },
}))

import {productboardClient} from "./index"
import linkProductboardNoteCustomer from "./link-productboard-note-customer.server"

const mockLinkCustomer = vi.mocked(productboardClient.notes.linkCustomer)

const customerNotFoundError = {
    code: ProductboardClientErrorCode.HttpError,
    errorMessage: "Not found",
    apiError: {
        status: 404,
        code: "resource.notFound",
        detail: "Customer with id user-new not found",
    },
}

describe(linkProductboardNoteCustomer, () => {
    beforeEach(() => {
        mockLinkCustomer.mockReset()
        vi.useRealTimers()
    })

    it("links a customer without retrying when eventual consistency retry is disabled", async () => {
        mockLinkCustomer.mockResolvedValue(complete(undefined))

        const result = await linkProductboardNoteCustomer({
            noteId: "note-1",
            customerEmail: "person@acme.com",
        })

        expect(isComplete(result)).toBe(true)
        expect(mockLinkCustomer).toHaveBeenCalledTimes(1)
    })

    it("retries with exponential backoff when a newly created customer is not yet linkable", async () => {
        vi.useFakeTimers()
        mockLinkCustomer
            .mockResolvedValueOnce(errored(customerNotFoundError))
            .mockResolvedValueOnce(errored(customerNotFoundError))
            .mockResolvedValueOnce(complete(undefined))

        const resultPromise = linkProductboardNoteCustomer({
            noteId: "note-1",
            customerEmail: "new@acme.com",
            allowEventualConsistencyRetry: true,
        })

        await vi.advanceTimersByTimeAsync(1000)
        await vi.advanceTimersByTimeAsync(2000)

        const result = await resultPromise

        expect(isComplete(result)).toBe(true)
        expect(mockLinkCustomer).toHaveBeenCalledTimes(3)
    })

    it("stops retrying after 25 seconds of exponential backoff", async () => {
        vi.useFakeTimers()
        mockLinkCustomer.mockResolvedValue(errored(customerNotFoundError))

        const resultPromise = linkProductboardNoteCustomer({
            noteId: "note-1",
            customerEmail: "new@acme.com",
            allowEventualConsistencyRetry: true,
        })

        await vi.advanceTimersByTimeAsync(25_000)

        const result = await resultPromise

        expect(result.state).toBe("error")
        // 1s + 2s + 4s + 8s + 10s = 25s → 6 link attempts (initial + 5 retries)
        expect(mockLinkCustomer).toHaveBeenCalledTimes(6)
    })

    it("does not retry when the link error is not a customer-not-found error", async () => {
        mockLinkCustomer.mockResolvedValue(
            errored({
                code: ProductboardClientErrorCode.HttpError,
                errorMessage: "Forbidden",
                apiError: {status: 403},
            })
        )

        const result = await linkProductboardNoteCustomer({
            noteId: "note-1",
            customerEmail: "new@acme.com",
            allowEventualConsistencyRetry: true,
        })

        expect(result.state).toBe("error")
        expect(mockLinkCustomer).toHaveBeenCalledTimes(1)
    })

    it("retries with a fixed interval when fixedIntervalRetry is configured", async () => {
        vi.useFakeTimers()
        mockLinkCustomer
            .mockResolvedValueOnce(errored(customerNotFoundError))
            .mockResolvedValueOnce(errored(customerNotFoundError))
            .mockResolvedValueOnce(complete(undefined))

        const resultPromise = linkProductboardNoteCustomer({
            noteId: "note-1",
            customerEmail: "new@acme.com",
            fixedIntervalRetry: {intervalMs: 1000, maxDurationMs: 20_000},
        })

        await vi.advanceTimersByTimeAsync(1000)
        await vi.advanceTimersByTimeAsync(1000)

        const result = await resultPromise

        expect(isComplete(result)).toBe(true)
        expect(mockLinkCustomer).toHaveBeenCalledTimes(3)
    })

    it("stops fixed-interval retries after maxDurationMs", async () => {
        vi.useFakeTimers()
        mockLinkCustomer.mockResolvedValue(errored(customerNotFoundError))

        const resultPromise = linkProductboardNoteCustomer({
            noteId: "note-1",
            customerEmail: "new@acme.com",
            fixedIntervalRetry: {intervalMs: 1000, maxDurationMs: 20_000},
        })

        await vi.advanceTimersByTimeAsync(20_000)

        const result = await resultPromise

        expect(result.state).toBe("error")
        expect(mockLinkCustomer).toHaveBeenCalledTimes(21)
    })
})
