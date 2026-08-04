import {complete, errored, isComplete, isErrored} from "@attio/fetchable"
import {beforeEach, describe, expect, it, vi} from "vitest"
import {endpoints, ProductboardClientErrorCode} from "../client/productboard-client"
import {createNotesApi} from "./api"

vi.mock("../client/productboard-client", async () => {
    const actual = await vi.importActual("../client/productboard-client")
    return {
        ...actual,
        productboardHttpClient: {get: vi.fn(), post: vi.fn(), put: vi.fn()},
    }
})

import {productboardHttpClient} from "../client/productboard-client"

const mockProductboardPost = vi.mocked(productboardHttpClient.post)
const mockProductboardPut = vi.mocked(productboardHttpClient.put)

describe(createNotesApi, () => {
    beforeEach(() => {
        mockProductboardPost.mockReset()
        mockProductboardPut.mockReset()
    })

    it("sends the note payload with tags and feature relationships", async () => {
        mockProductboardPost.mockResolvedValue(
            complete({
                statusCode: 201,
                data: {
                    data: {id: "note-1", links: {html: "https://productboard.com/notes/note-1"}},
                },
            })
        )

        const api = createNotesApi()
        await api.create({
            feedbackText: "Great feature request",
            tagName: "urgent",
            relationships: [{type: "link", target: {id: "feature-1"}}],
        })

        expect(mockProductboardPost).toHaveBeenCalledWith(endpoints.api.notes, {
            data: {
                type: "textNote",
                fields: {
                    name: "Feedback from Attio",
                    content: "Great feature request",
                    tags: [{name: "urgent"}],
                },
                relationships: [{type: "link", target: {id: "feature-1"}}],
            },
        })
    })

    it("omits tags and relationships when not provided", async () => {
        mockProductboardPost.mockResolvedValue(
            complete({statusCode: 201, data: {data: {id: "note-1"}}})
        )

        const api = createNotesApi()
        await api.create({feedbackText: "Great feature request"})

        const body = mockProductboardPost.mock.calls[0][1] as {
            data: {type: string; fields: Record<string, unknown>; relationships?: unknown[]}
        }
        expect(body).toMatchObject({
            data: {type: "textNote", fields: {content: "Great feature request"}},
        })
        expect(body.data.fields).not.toHaveProperty("tags")
        expect(body.data).not.toHaveProperty("relationships")
    })

    it("returns the created note id and url", async () => {
        mockProductboardPost.mockResolvedValue(
            complete({
                statusCode: 201,
                data: {
                    data: {id: "note-1", links: {html: "https://productboard.com/notes/note-1"}},
                },
            })
        )

        const api = createNotesApi()
        const result = await api.create({feedbackText: "Great feature request"})

        expect(isComplete(result)).toBe(true)
        if (isComplete(result)) {
            expect(result.value).toEqual({
                id: "note-1",
                url: "https://productboard.com/notes/note-1",
            })
        }
    })

    it("returns client errors unchanged", async () => {
        const clientError = {code: ProductboardClientErrorCode.HttpError, errorMessage: "Not found"}
        mockProductboardPost.mockResolvedValue(errored(clientError))

        const api = createNotesApi()
        const result = await api.create({feedbackText: "Great feature request"})

        expect(isErrored(result)).toBe(true)
        if (isErrored(result)) {
            expect(result.error).toEqual(clientError)
        }
    })

    it("links a customer to a note by email", async () => {
        mockProductboardPut.mockResolvedValue(complete({statusCode: 200, data: undefined}))

        const api = createNotesApi()
        const result = await api.linkCustomer({noteId: "note-1", customerEmail: "person@acme.com"})

        expect(isComplete(result)).toBe(true)
        expect(mockProductboardPut).toHaveBeenCalledWith(
            endpoints.api.noteCustomerRelationship("note-1"),
            {
                data: {target: {type: "user", email: "person@acme.com"}},
            }
        )
    })
})
