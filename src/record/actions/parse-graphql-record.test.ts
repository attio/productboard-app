import {describe, expect, it} from "vitest"

import {parseCompanyFromGraphql, parsePersonFromGraphql} from "./parse-graphql-record"

describe(parsePersonFromGraphql, () => {
    it("returns null when person is missing", () => {
        expect(parsePersonFromGraphql(null)).toBeNull()
        expect(parsePersonFromGraphql(undefined)).toBeNull()
    })

    it("returns null when person has no name or email", () => {
        expect(parsePersonFromGraphql({name: null, email_addresses: []})).toBeNull()
    })

    it("parses name and string email addresses", () => {
        expect(
            parsePersonFromGraphql({
                name: {full_name: "Jane Doe"},
                email_addresses: ["jane@example.com"],
            })
        ).toEqual({name: "Jane Doe", email: "jane@example.com"})
    })

    it("parses object email addresses", () => {
        expect(
            parsePersonFromGraphql({
                name: {full_name: "Jane Doe"},
                email_addresses: [{email_address: "jane@example.com"}],
            })
        ).toEqual({name: "Jane Doe", email: "jane@example.com"})
    })

    it("accepts email-only records", () => {
        expect(
            parsePersonFromGraphql({
                email_addresses: ["jane@example.com"],
            })
        ).toEqual({name: "", email: "jane@example.com"})
    })
})

describe(parseCompanyFromGraphql, () => {
    it("returns null when company is missing", () => {
        expect(parseCompanyFromGraphql(null)).toBeNull()
    })

    it("returns null when company has no name or domain", () => {
        expect(parseCompanyFromGraphql({name: "", domains: []})).toBeNull()
    })

    it("parses name and string domains", () => {
        expect(
            parseCompanyFromGraphql({
                name: "Acme Inc",
                domains: ["acme.com"],
            })
        ).toEqual({name: "Acme Inc", domain: "acme.com"})
    })

    it("parses object domains", () => {
        expect(
            parseCompanyFromGraphql({
                name: "Acme Inc",
                domains: [{domain: "acme.com"}],
            })
        ).toEqual({name: "Acme Inc", domain: "acme.com"})
    })

    it("accepts domain-only records", () => {
        expect(
            parseCompanyFromGraphql({
                domains: ["acme.com"],
            })
        ).toEqual({name: "", domain: "acme.com"})
    })
})
