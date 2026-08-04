import {complete, errored, isComplete, isErrored} from "@attio/fetchable"
import {beforeEach, describe, expect, it, vi} from "vitest"
import {ProductboardClientErrorCode} from "../client/productboard-client"
import {createCustomersApi} from "./api"

vi.mock("../client/productboard-client", async () => {
    const actual = await vi.importActual("../client/productboard-client")
    return {
        ...actual,
        productboardHttpClient: {get: vi.fn(), post: vi.fn()},
    }
})

import {productboardHttpClient} from "../client/productboard-client"

const mockProductboardPost = vi.mocked(productboardHttpClient.post)

describe(createCustomersApi, () => {
    beforeEach(() => {
        mockProductboardPost.mockReset()
    })

    describe("searchByEmail", () => {
        it("returns the matching user id", async () => {
            mockProductboardPost.mockResolvedValue(
                complete({
                    statusCode: 200,
                    data: {
                        data: [{id: "user-1", type: "user", fields: {email: "person@acme.com"}}],
                    },
                })
            )

            const api = createCustomersApi()
            const result = await api.searchByEmail("person@acme.com")

            expect(isComplete(result)).toBe(true)
            if (isComplete(result)) {
                expect(result.value).toBe("user-1")
            }
        })

        it("returns null when no user matches by email", async () => {
            mockProductboardPost.mockResolvedValue(
                complete({
                    statusCode: 200,
                    data: {
                        data: [{id: "user-1", type: "user", fields: {email: "other@acme.com"}}],
                    },
                })
            )

            const api = createCustomersApi()
            const result = await api.searchByEmail("person@acme.com")

            expect(isComplete(result)).toBe(true)
            if (isComplete(result)) {
                expect(result.value).toBeNull()
            }
        })

        it("returns client errors unchanged", async () => {
            const clientError = {
                code: ProductboardClientErrorCode.HttpError,
                errorMessage: "Unauthorized",
            }
            mockProductboardPost.mockResolvedValue(errored(clientError))

            const api = createCustomersApi()
            const result = await api.searchByEmail("person@acme.com")

            expect(isErrored(result)).toBe(true)
            if (isErrored(result)) {
                expect(result.error).toEqual(clientError)
            }
        })
    })

    describe("create", () => {
        it("returns the created customer id", async () => {
            mockProductboardPost.mockResolvedValue(
                complete({statusCode: 201, data: {data: {id: "user-2"}}})
            )

            const api = createCustomersApi()
            const result = await api.create({email: "person@acme.com", name: "Person"})

            expect(isComplete(result)).toBe(true)
            if (isComplete(result)) {
                expect(result.value).toBe("user-2")
            }
        })
    })
})
