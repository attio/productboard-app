import {complete, errored} from "@attio/fetchable"
import {beforeEach, describe, expect, it, vi} from "vitest"
import {ProductboardClientErrorCode} from "./client/productboard-client"

vi.mock("./link-productboard-note-customer.server", () => ({
    default: vi.fn(),
}))

import linkProductboardNoteCustomer from "./link-productboard-note-customer.server"
import {
    parsePendingNoteLink,
    pendingNoteLinkByExecutionKey,
    pendingNoteLinkByNoteKey,
    retryPendingNoteLink,
    serializePendingNoteLink,
} from "./pending-note-link.server"

const mockLinkCustomer = vi.mocked(linkProductboardNoteCustomer)

const customerNotFoundError = {
    code: ProductboardClientErrorCode.HttpError,
    errorMessage: "Not found",
    apiError: {
        status: 404,
        code: "resource.notFound",
        detail: "Customer with email new@acme.com not found",
    },
}

const pendingLink = {
    noteId: "note-1",
    noteUrl: "https://pb/note-1",
    customerEmail: "new@acme.com",
}

describe(pendingNoteLinkByNoteKey, () => {
    it("builds a stable key from the note id", () => {
        expect(pendingNoteLinkByNoteKey("note-1")).toBe("pb-pending-link:note:note-1")
    })
})

describe(pendingNoteLinkByExecutionKey, () => {
    it("builds a stable key from the workflow execution id", () => {
        expect(pendingNoteLinkByExecutionKey("exec-123")).toBe("pb-pending-link:exec:exec-123")
    })
})

describe(serializePendingNoteLink, () => {
    it("round-trips pending link data", () => {
        const serialized = serializePendingNoteLink(pendingLink)
        expect(parsePendingNoteLink(serialized)).toEqual(pendingLink)
    })

    it("ignores legacy customerId fields when parsing", () => {
        const legacy = JSON.stringify({
            noteId: "note-1",
            noteUrl: "https://pb/note-1",
            customerId: "user-new",
            customerEmail: "new@acme.com",
        })

        expect(parsePendingNoteLink(legacy)).toEqual(pendingLink)
    })
})

describe(retryPendingNoteLink, () => {
    beforeEach(() => {
        mockLinkCustomer.mockReset()
    })

    it("links using the stored customer email", async () => {
        mockLinkCustomer.mockResolvedValue(complete(undefined))

        const result = await retryPendingNoteLink(pendingLink)

        expect(result).toEqual(complete({id: "note-1", url: "https://pb/note-1"}))
        expect(mockLinkCustomer).toHaveBeenCalledWith({
            noteId: "note-1",
            customerEmail: "new@acme.com",
            allowEventualConsistencyRetry: false,
        })
    })

    it("uses exponential backoff when requested", async () => {
        mockLinkCustomer.mockResolvedValue(complete(undefined))

        await retryPendingNoteLink(pendingLink, {allowEventualConsistencyRetry: true})

        expect(mockLinkCustomer).toHaveBeenCalledWith({
            noteId: "note-1",
            customerEmail: "new@acme.com",
            allowEventualConsistencyRetry: true,
        })
    })

    it("returns a note-not-linked error when email linking still fails", async () => {
        mockLinkCustomer.mockResolvedValue(errored(customerNotFoundError))

        const result = await retryPendingNoteLink(pendingLink)

        expect(result.state).toBe("error")
        expect(mockLinkCustomer).toHaveBeenCalledTimes(1)
    })
})
