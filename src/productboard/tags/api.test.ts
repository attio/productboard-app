import {complete, errored, isComplete} from "@attio/fetchable"
import {beforeEach, describe, expect, it, vi} from "vitest"
import {endpoints, ProductboardClientErrorCode} from "../client/productboard-client"
import {createTagsApi} from "./api"

vi.mock("../client/productboard-client", async () => {
    const actual = await vi.importActual("../client/productboard-client")
    return {
        ...actual,
        productboardHttpClient: {get: vi.fn(), post: vi.fn()},
        fetchAllProductboardPages: vi.fn(),
    }
})

import {fetchAllProductboardPages, productboardHttpClient} from "../client/productboard-client"

const mockProductboardGet = vi.mocked(productboardHttpClient.get)
const mockFetchAllProductboardPages = vi.mocked(fetchAllProductboardPages)

describe(createTagsApi, () => {
    beforeEach(() => {
        mockProductboardGet.mockReset()
        mockFetchAllProductboardPages.mockReset()
    })

    it("returns sorted, de-duplicated tags from note configuration", async () => {
        mockProductboardGet.mockResolvedValueOnce(
            complete({
                statusCode: 200,
                data: {
                    data: {
                        fields: {
                            tags: {
                                values: {
                                    data: [
                                        {id: "tag-1", name: "urgent"},
                                        {id: "tag-2", name: "bug"},
                                        {id: "tag-3", name: "urgent"},
                                    ],
                                },
                            },
                        },
                    },
                },
            })
        )

        const api = createTagsApi()
        const result = await api.list()

        expect(isComplete(result)).toBe(true)
        if (isComplete(result)) {
            expect(result.value).toEqual([
                {id: "bug", name: "bug"},
                {id: "urgent", name: "urgent"},
            ])
        }
        expect(mockProductboardGet).toHaveBeenCalledWith(
            endpoints.api.noteConfiguration("textNote")
        )
        expect(mockFetchAllProductboardPages).not.toHaveBeenCalled()
    })

    it("falls back to notes when note configuration has no tag values", async () => {
        mockProductboardGet.mockResolvedValueOnce(
            complete({
                statusCode: 200,
                data: {data: {fields: {tags: {values: {data: []}}}}},
            })
        )
        mockFetchAllProductboardPages.mockResolvedValueOnce(complete(["feature-request"]))

        const api = createTagsApi()
        const result = await api.list()

        expect(isComplete(result)).toBe(true)
        if (isComplete(result)) {
            expect(result.value).toEqual([{id: "feature-request", name: "feature-request"}])
        }
        expect(mockFetchAllProductboardPages).toHaveBeenCalledTimes(1)
    })

    it("falls back to notes when note configuration errors", async () => {
        const clientError = {
            code: ProductboardClientErrorCode.HttpError,
            errorMessage: "Missing scope",
        }
        mockProductboardGet.mockResolvedValueOnce(errored(clientError))
        mockFetchAllProductboardPages.mockResolvedValueOnce(complete(["feature-request"]))

        const api = createTagsApi()
        const result = await api.list()

        expect(isComplete(result)).toBe(true)
        if (isComplete(result)) {
            expect(result.value).toEqual([{id: "feature-request", name: "feature-request"}])
        }
    })
})
