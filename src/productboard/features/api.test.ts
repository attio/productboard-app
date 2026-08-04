import {complete, errored, isComplete, isErrored} from "@attio/fetchable"
import {beforeEach, describe, expect, it, vi} from "vitest"
import {ProductboardClientErrorCode} from "../client/productboard-client"
import {createFeaturesApi} from "./api"

vi.mock("../client/productboard-client", async () => {
    const actual = await vi.importActual("../client/productboard-client")
    return {...actual, fetchAllProductboardPages: vi.fn()}
})

import {fetchAllProductboardPages} from "../client/productboard-client"

const mockFetchAllProductboardPages = vi.mocked(fetchAllProductboardPages)

const features = [
    {id: "feature-1", name: "Dark mode"},
    {id: "feature-2", name: "Bulk export"},
]

describe(createFeaturesApi, () => {
    beforeEach(() => {
        mockFetchAllProductboardPages.mockReset()
    })

    describe("list", () => {
        it("returns all features", async () => {
            mockFetchAllProductboardPages.mockResolvedValue(complete(features))

            const api = createFeaturesApi()
            const result = await api.list()

            expect(isComplete(result)).toBe(true)
            if (isComplete(result)) {
                expect(result.value).toEqual(features)
            }
        })

        it("returns client errors unchanged", async () => {
            const clientError = {
                code: ProductboardClientErrorCode.HttpError,
                errorMessage: "Unauthorized",
            }
            mockFetchAllProductboardPages.mockResolvedValue(errored(clientError))

            const api = createFeaturesApi()
            const result = await api.list()

            expect(isErrored(result)).toBe(true)
            if (isErrored(result)) {
                expect(result.error).toEqual(clientError)
            }
        })
    })

    describe("searchByName", () => {
        it("returns the first 50 features when the query is too short", async () => {
            mockFetchAllProductboardPages.mockResolvedValue(complete(features))

            const api = createFeaturesApi()
            const result = await api.searchByName("a")

            expect(isComplete(result)).toBe(true)
            if (isComplete(result)) {
                expect(result.value).toEqual(features)
            }
        })

        it("filters features by name case-insensitively", async () => {
            mockFetchAllProductboardPages.mockResolvedValue(complete(features))

            const api = createFeaturesApi()
            const result = await api.searchByName("dark")

            expect(isComplete(result)).toBe(true)
            if (isComplete(result)) {
                expect(result.value).toEqual([features[0]])
            }
        })
    })
})
