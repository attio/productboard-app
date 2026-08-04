import {describe, expect, it} from "vitest"
import {isCustomerNotFoundError} from "./customer-not-found"

describe(isCustomerNotFoundError, () => {
    it("returns true for note customer 404 resource.notFound errors", () => {
        expect(
            isCustomerNotFoundError({
                apiError: {
                    status: 404,
                    code: "resource.notFound",
                },
            })
        ).toBe(true)
    })

    it("returns true for explicit customer-not-found details", () => {
        expect(
            isCustomerNotFoundError({
                apiError: {
                    status: 422,
                    detail: "Customer with email user@example.com not found",
                },
            })
        ).toBe(true)
    })

    it("returns false for unrelated 404 route errors", () => {
        expect(
            isCustomerNotFoundError({
                apiError: {
                    status: 404,
                    code: "route.notFound",
                },
            })
        ).toBe(false)
    })
})
