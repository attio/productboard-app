import {complete, errored, isErrored} from "@attio/fetchable"
import {beforeEach, describe, expect, it, vi} from "vitest"
import {ProductboardClientErrorCode} from "./client/productboard-client"
import {ProductboardUserError} from "./client/user-errors"

const mockSearchByEmail = vi.fn()
const mockCreate = vi.fn()

vi.mock("./index", () => ({
    productboardClient: {
        customers: {
            searchByEmail: (...args: unknown[]) => mockSearchByEmail(...args),
            create: (...args: unknown[]) => mockCreate(...args),
        },
    },
}))

import ensureProductboardCustomer, {
    createProductboardCustomer,
    searchProductboardCustomer,
} from "./ensure-productboard-customer.server"

describe(ensureProductboardCustomer, () => {
    beforeEach(() => {
        mockSearchByEmail.mockReset()
        mockCreate.mockReset()
    })

    it("returns the existing customer id when one is found", async () => {
        mockSearchByEmail.mockResolvedValue(complete("user-1"))

        const result = await ensureProductboardCustomer({
            personName: "Person",
            personEmail: "person@acme.com",
        })

        expect(result).toEqual(complete("user-1"))
        expect(mockCreate).not.toHaveBeenCalled()
    })

    it("creates a customer and returns the id from the POST response when not found", async () => {
        mockSearchByEmail.mockResolvedValueOnce(complete(null))
        mockCreate.mockResolvedValue(complete("user-new"))

        const result = await ensureProductboardCustomer({
            personName: "Person",
            personEmail: "new@acme.com",
        })

        expect(result).toEqual(complete("user-new"))
        expect(mockCreate).toHaveBeenCalledWith({
            email: "new@acme.com",
            name: "Person",
        })
        expect(mockSearchByEmail).toHaveBeenCalledTimes(1)
    })

    it("creates a customer when search returns a not-found error", async () => {
        mockSearchByEmail.mockResolvedValueOnce(
            errored({
                code: ProductboardClientErrorCode.HttpError,
                errorMessage: "Not found",
                apiError: {status: 404, code: "resource.notFound", title: "Resource not found"},
            })
        )
        mockCreate.mockResolvedValue(complete("user-new"))

        const result = await ensureProductboardCustomer({
            personName: "Person",
            personEmail: "new@acme.com",
        })

        expect(result).toEqual(complete("user-new"))
        expect(mockCreate).toHaveBeenCalledWith({
            email: "new@acme.com",
            name: "Person",
        })
    })

    it("creates a customer when search fails with a non-not-found error", async () => {
        mockSearchByEmail.mockResolvedValueOnce(
            errored({
                code: ProductboardClientErrorCode.HttpError,
                errorMessage: "Unauthorized",
                apiError: {status: 401},
            })
        )
        mockCreate.mockResolvedValue(complete("user-new"))

        const result = await ensureProductboardCustomer({
            personName: "Person",
            personEmail: "person@acme.com",
        })

        expect(result).toEqual(complete("user-new"))
        expect(mockCreate).toHaveBeenCalledWith({
            email: "person@acme.com",
            name: "Person",
        })
    })

    it("returns a user error when no email or domain is available", async () => {
        const result = await ensureProductboardCustomer({
            personName: "Person",
            personEmail: "",
        })

        expect(isErrored(result)).toBe(true)
        if (isErrored(result)) {
            expect(result.error).toBeInstanceOf(ProductboardUserError)
        }
        expect(mockSearchByEmail).not.toHaveBeenCalled()
    })

    it("re-checks search when create fails due to a concurrent create", async () => {
        const clientError = {
            code: ProductboardClientErrorCode.HttpError,
            errorMessage: "Conflict",
        }
        mockSearchByEmail
            .mockResolvedValueOnce(complete(null))
            .mockResolvedValueOnce(complete("user-4"))
        mockCreate.mockResolvedValue(errored(clientError))

        const result = await ensureProductboardCustomer({
            personName: "Person",
            personEmail: "new@acme.com",
        })

        expect(result).toEqual(complete("user-4"))
    })

    it("returns a user error when create fails and re-check finds nothing", async () => {
        const clientError = {
            code: ProductboardClientErrorCode.HttpError,
            errorMessage: "Conflict",
        }
        mockSearchByEmail
            .mockResolvedValueOnce(complete(null))
            .mockResolvedValueOnce(complete(null))
        mockCreate.mockResolvedValue(errored(clientError))

        const result = await createProductboardCustomer({
            personName: "Person",
            personEmail: "new@acme.com",
        })

        expect(isErrored(result)).toBe(true)
    })

    it("returns null when search finds no customer", async () => {
        mockSearchByEmail.mockResolvedValue(complete(null))

        const result = await searchProductboardCustomer({
            personEmail: "new@acme.com",
        })

        expect(result).toEqual(complete(null))
        expect(mockCreate).not.toHaveBeenCalled()
    })
})
