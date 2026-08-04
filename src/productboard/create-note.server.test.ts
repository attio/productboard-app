import {complete, errored} from "@attio/fetchable"
import {beforeEach, describe, expect, it, vi} from "vitest"
import {ProductboardClientErrorCode} from "./client/productboard-client"
import {ProductboardNoteNotLinkedError, ProductboardUserError} from "./client/user-errors"

vi.mock("./customers/api")
vi.mock("./notes/api")
vi.mock("./ensure-productboard-customer.server", () => ({
    searchProductboardCustomer: vi.fn(),
    createProductboardCustomer: vi.fn(),
}))
vi.mock("./create-productboard-note.server", () => ({default: vi.fn()}))
vi.mock("./link-productboard-note-customer.server", () => ({
    default: vi.fn(),
    DEFAULT_FIXED_LINK_RETRY: {intervalMs: 1000, maxDurationMs: 20_000},
}))
vi.mock("./pending-note-link.server", () => ({
    savePendingNoteLinkByNoteId: vi.fn(),
}))

import {createCustomersApi} from "./customers/api"
import {createNotesApi} from "./notes/api"
import createProductboardNote from "./create-productboard-note.server"
import submitProductboardInsight from "./create-note.server"
import {
    createProductboardCustomer,
    searchProductboardCustomer,
} from "./ensure-productboard-customer.server"
import linkProductboardNoteCustomer from "./link-productboard-note-customer.server"
import {savePendingNoteLinkByNoteId} from "./pending-note-link.server"

const mockCreateNote = vi.fn()
const mockSearchCustomer = vi.mocked(searchProductboardCustomer)
const mockCreateCustomer = vi.mocked(createProductboardCustomer)
const mockLinkCustomer = vi.mocked(linkProductboardNoteCustomer)
const mockSavePending = vi.mocked(savePendingNoteLinkByNoteId)

vi.mocked(createNotesApi).mockReturnValue({create: mockCreateNote, linkCustomer: vi.fn()})
vi.mocked(createCustomersApi).mockReturnValue({
    searchByEmail: vi.fn(),
    create: vi.fn(),
})
vi.mocked(createProductboardNote).mockImplementation(mockCreateNote)

describe(submitProductboardInsight, () => {
    beforeEach(() => {
        mockCreateNote.mockReset()
        mockSearchCustomer.mockReset()
        mockCreateCustomer.mockReset()
        mockLinkCustomer.mockReset()
        mockSavePending.mockReset()
        mockSearchCustomer.mockResolvedValue(complete("user-1"))
        mockLinkCustomer.mockResolvedValue(complete(undefined))
    })

    it("creates the note and searches for the customer in parallel, then links by email", async () => {
        mockCreateNote.mockResolvedValue(complete({id: "note-1", url: "https://pb/note-1"}))

        const result = await submitProductboardInsight({
            personName: "Person",
            personEmail: "person@acme.com",
            feedbackText: "Feedback",
        })

        expect(result).toEqual(complete({id: "note-1", url: "https://pb/note-1"}))
        expect(mockCreateNote).toHaveBeenCalledWith({
            personName: "Person",
            personEmail: "person@acme.com",
            feedbackText: "Feedback",
        })
        expect(mockSearchCustomer).toHaveBeenCalledWith({
            personName: "Person",
            personEmail: "person@acme.com",
            feedbackText: "Feedback",
        })
        expect(mockCreateCustomer).not.toHaveBeenCalled()
        expect(mockLinkCustomer).toHaveBeenCalledWith({
            noteId: "note-1",
            customerEmail: "person@acme.com",
            allowEventualConsistencyRetry: false,
        })
    })

    it("creates a customer and links when search returns no match", async () => {
        mockSearchCustomer.mockResolvedValue(complete(null))
        mockCreateCustomer.mockResolvedValue(complete("user-new"))
        mockCreateNote.mockResolvedValue(complete({id: "note-1", url: "https://pb/note-1"}))

        const result = await submitProductboardInsight({
            personName: "Person",
            personEmail: "new@acme.com",
            feedbackText: "Feedback",
        })

        expect(result).toEqual(complete({id: "note-1", url: "https://pb/note-1"}))
        expect(mockCreateCustomer).toHaveBeenCalledWith({
            personName: "Person",
            personEmail: "new@acme.com",
            feedbackText: "Feedback",
        })
        expect(mockLinkCustomer).toHaveBeenCalledWith({
            noteId: "note-1",
            customerEmail: "new@acme.com",
            allowEventualConsistencyRetry: false,
        })
    })

    it("queues a deferred link when deferLinkOnFailure is enabled", async () => {
        mockCreateNote.mockResolvedValue(complete({id: "note-1", url: "https://pb/note-1"}))
        mockLinkCustomer.mockResolvedValue(
            errored({
                code: ProductboardClientErrorCode.HttpError,
                errorMessage: "Not found",
                apiError: {
                    status: 404,
                    code: "resource.notFound",
                    detail: "Customer with id user-new not found",
                },
            })
        )

        const result = await submitProductboardInsight(
            {
                personName: "Person",
                personEmail: "new@acme.com",
                feedbackText: "Feedback",
            },
            {deferLinkOnFailure: true}
        )

        expect(result).toEqual(
            complete({id: "note-1", url: "https://pb/note-1", linkPending: true})
        )
        expect(mockSavePending).toHaveBeenCalledWith("note-1", {
            noteId: "note-1",
            noteUrl: "https://pb/note-1",
            customerEmail: "new@acme.com",
        })
    })

    it("returns an error when note creation fails", async () => {
        mockCreateNote.mockResolvedValue(
            errored({
                code: ProductboardClientErrorCode.HttpError,
                errorMessage: "Rejected",
                apiError: {status: 422},
            })
        )

        const result = await submitProductboardInsight({
            personName: "Person",
            personEmail: "person@acme.com",
            feedbackText: "Feedback",
        })

        expect(result.state).toBe("error")
        expect(mockCreateCustomer).not.toHaveBeenCalled()
        expect(mockLinkCustomer).not.toHaveBeenCalled()
    })

    it("returns an error when customer creation fails", async () => {
        mockSearchCustomer.mockResolvedValue(complete(null))
        mockCreateNote.mockResolvedValue(complete({id: "note-1", url: "https://pb/note-1"}))
        mockCreateCustomer.mockResolvedValue(errored(new ProductboardUserError("Rejected")))

        const result = await submitProductboardInsight({
            personName: "Person",
            personEmail: "person@acme.com",
            feedbackText: "Feedback",
        })

        expect(result.state).toBe("error")
        expect(mockLinkCustomer).not.toHaveBeenCalled()
    })

    it("starts note creation and customer search together", async () => {
        let resolveCreateNote: (value: unknown) => void = () => {}
        let resolveSearchCustomer: (value: unknown) => void = () => {}
        const createNoteStarted = new Promise<void>((resolve) => {
            mockCreateNote.mockImplementation(
                () =>
                    new Promise((innerResolve) => {
                        resolveCreateNote = innerResolve as (value: unknown) => void
                        resolve()
                    })
            )
        })
        const searchCustomerStarted = new Promise<void>((resolve) => {
            mockSearchCustomer.mockImplementation(
                () =>
                    new Promise((innerResolve) => {
                        resolveSearchCustomer = innerResolve as (value: unknown) => void
                        resolve()
                    })
            )
        })

        const submission = submitProductboardInsight({
            personName: "Person",
            personEmail: "person@acme.com",
            feedbackText: "Feedback",
        })

        await Promise.all([createNoteStarted, searchCustomerStarted])
        resolveCreateNote(complete({id: "note-1", url: "https://pb/note-1"}))
        resolveSearchCustomer(complete("user-1"))

        await expect(submission).resolves.toEqual(
            complete({id: "note-1", url: "https://pb/note-1"})
        )
    })

    it("creates the note without linking when there is no customer email to resolve", async () => {
        mockCreateNote.mockResolvedValue(complete({id: "note-1", url: "https://pb/note-1"}))

        const result = await submitProductboardInsight({
            personName: "Person",
            personEmail: "",
            feedbackText: "Feedback",
        })

        expect(result).toEqual(complete({id: "note-1", url: "https://pb/note-1"}))
        expect(mockSearchCustomer).not.toHaveBeenCalled()
        expect(mockCreateCustomer).not.toHaveBeenCalled()
        expect(mockLinkCustomer).not.toHaveBeenCalled()
    })

    it("returns a note-not-linked error when linking fails", async () => {
        mockCreateNote.mockResolvedValue(complete({id: "note-1", url: "https://pb/note-1"}))
        mockLinkCustomer.mockResolvedValue(
            errored({
                code: ProductboardClientErrorCode.HttpError,
                errorMessage: "Not found",
                apiError: {status: 404, code: "resource.notFound", title: "Resource not found"},
            })
        )

        const result = await submitProductboardInsight({
            personName: "Person",
            personEmail: "person@acme.com",
            feedbackText: "Feedback",
        })

        expect(result.state).toBe("error")
        if (result.state === "error") {
            expect(result.error).toBeInstanceOf(ProductboardNoteNotLinkedError)
        }
        expect(mockCreateCustomer).not.toHaveBeenCalled()
        expect(mockLinkCustomer).toHaveBeenCalledTimes(1)
    })

    it("returns the note when ignoreLinkFailure is enabled and linking fails", async () => {
        mockCreateNote.mockResolvedValue(complete({id: "note-1", url: "https://pb/note-1"}))
        mockLinkCustomer.mockResolvedValue(
            errored({
                code: ProductboardClientErrorCode.HttpError,
                errorMessage: "Not found",
                apiError: {status: 404, code: "resource.notFound", title: "Resource not found"},
            })
        )

        const result = await submitProductboardInsight(
            {
                personName: "Person",
                personEmail: "person@acme.com",
                feedbackText: "Feedback",
            },
            {
                ignoreLinkFailure: true,
                fixedLinkRetry: {intervalMs: 1000, maxDurationMs: 20_000},
            }
        )

        expect(result).toEqual(
            complete({id: "note-1", url: "https://pb/note-1", isNoteLinked: false})
        )
        expect(mockLinkCustomer).toHaveBeenCalledWith({
            noteId: "note-1",
            customerEmail: "person@acme.com",
            fixedIntervalRetry: {intervalMs: 1000, maxDurationMs: 20_000},
        })
    })

    it("returns isNoteLinked when ignoreLinkFailure is enabled and linking succeeds", async () => {
        mockCreateNote.mockResolvedValue(complete({id: "note-1", url: "https://pb/note-1"}))
        mockLinkCustomer.mockResolvedValue(complete(undefined))

        const result = await submitProductboardInsight(
            {
                personName: "Person",
                personEmail: "person@acme.com",
                feedbackText: "Feedback",
            },
            {ignoreLinkFailure: true}
        )

        expect(result).toEqual(
            complete({id: "note-1", url: "https://pb/note-1", isNoteLinked: true})
        )
    })

    it("still fails when note creation fails and ignoreLinkFailure is enabled", async () => {
        mockCreateNote.mockResolvedValue(
            errored({
                code: ProductboardClientErrorCode.HttpError,
                errorMessage: "Rejected",
                apiError: {status: 422},
            })
        )

        const result = await submitProductboardInsight(
            {
                personName: "Person",
                personEmail: "person@acme.com",
                feedbackText: "Feedback",
            },
            {ignoreLinkFailure: true}
        )

        expect(result.state).toBe("error")
        expect(mockLinkCustomer).not.toHaveBeenCalled()
    })
})
