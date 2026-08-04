import {complete, errored} from "@attio/fetchable"
import {beforeEach, describe, expect, it, vi} from "vitest"
import {ProductboardNoteNotLinkedError} from "./client/user-errors"

vi.mock("./pending-note-link.server", () => ({
    clearPendingNoteLinkByNoteId: vi.fn(),
    getPendingNoteLinkByNoteId: vi.fn(),
    retryPendingNoteLink: vi.fn(),
}))

import {
    clearPendingNoteLinkByNoteId,
    getPendingNoteLinkByNoteId,
    retryPendingNoteLink,
} from "./pending-note-link.server"
import retryPendingNoteLinkByNoteId from "./retry-pending-note-link.server"

const mockGetPending = vi.mocked(getPendingNoteLinkByNoteId)
const mockRetryPending = vi.mocked(retryPendingNoteLink)
const mockClearPending = vi.mocked(clearPendingNoteLinkByNoteId)

const pendingLink = {
    noteId: "note-1",
    noteUrl: "https://pb/note-1",
    customerEmail: "new@acme.com",
}

describe(retryPendingNoteLinkByNoteId, () => {
    beforeEach(() => {
        mockGetPending.mockReset()
        mockRetryPending.mockReset()
        mockClearPending.mockReset()
    })

    it("returns linked when there is no pending entry", async () => {
        mockGetPending.mockResolvedValue(null)

        const result = await retryPendingNoteLinkByNoteId({noteId: "note-1"})

        expect(result).toEqual(complete({linked: true}))
        expect(mockRetryPending).not.toHaveBeenCalled()
    })

    it("clears pending state and returns linked on success", async () => {
        mockGetPending.mockResolvedValue(pendingLink)
        mockRetryPending.mockResolvedValue(complete({id: "note-1", url: "https://pb/note-1"}))

        const result = await retryPendingNoteLinkByNoteId({noteId: "note-1"})

        expect(result).toEqual(complete({linked: true, id: "note-1", url: "https://pb/note-1"}))
        expect(mockClearPending).toHaveBeenCalledWith("note-1")
    })

    it("returns linked false when the customer is still not linkable", async () => {
        mockGetPending.mockResolvedValue(pendingLink)
        mockRetryPending.mockResolvedValue(
            errored(new ProductboardNoteNotLinkedError("https://pb/note-1", "note-1"))
        )

        const result = await retryPendingNoteLinkByNoteId({noteId: "note-1"})

        expect(result).toEqual(complete({linked: false, url: "https://pb/note-1"}))
        expect(mockClearPending).not.toHaveBeenCalled()
    })
})
