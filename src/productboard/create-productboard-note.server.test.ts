import {complete} from "@attio/fetchable"
import {beforeEach, describe, expect, it, vi} from "vitest"

vi.mock("./index", () => ({
    productboardClient: {
        notes: {
            create: vi.fn(),
        },
    },
}))

import {productboardClient} from "./index"
import createProductboardNote from "./create-productboard-note.server"

const mockCreateNote = vi.mocked(productboardClient.notes.create)

describe(createProductboardNote, () => {
    beforeEach(() => {
        mockCreateNote.mockReset()
        mockCreateNote.mockResolvedValue(complete({id: "note-1"}))
    })

    it("includes person data in note content", async () => {
        await createProductboardNote({
            feedbackText: "Great feedback",
            personName: "Jane Doe",
            personEmail: "jane@acme.com",
        })

        expect(mockCreateNote).toHaveBeenCalledWith({
            feedbackText: "Great feedback\n\nPerson name: Jane Doe\nUser email: jane@acme.com",
            tagName: undefined,
            relationships: undefined,
        })
    })

    it("includes company data in note content", async () => {
        await createProductboardNote({
            feedbackText: "Great feedback",
            personName: "Acme Inc",
            companyName: "Acme Inc",
            personEmail: "",
            companyDomain: "acme.com",
        })

        expect(mockCreateNote).toHaveBeenCalledWith({
            feedbackText:
                "Great feedback\n\nCompany name: Acme Inc\nCompany domain: acme.com\nUser email: feedback@acme.com",
            tagName: undefined,
            relationships: undefined,
        })
    })

    it("includes both person and company data when both are provided", async () => {
        await createProductboardNote({
            feedbackText: "Great feedback",
            personName: "Jane Doe",
            personEmail: "jane@acme.com",
            companyName: "Acme Inc",
            companyDomain: "acme.com",
        })

        expect(mockCreateNote).toHaveBeenCalledWith({
            feedbackText:
                "Great feedback\n\nPerson name: Jane Doe\nUser email: jane@acme.com\nCompany name: Acme Inc\nCompany domain: acme.com",
            tagName: undefined,
            relationships: undefined,
        })
    })

    it("leaves note content unchanged when no record data is available", async () => {
        await createProductboardNote({
            feedbackText: "Great feedback",
            personName: "",
            personEmail: "",
        })

        expect(mockCreateNote).toHaveBeenCalledWith({
            feedbackText: "Great feedback",
            tagName: undefined,
            relationships: undefined,
        })
    })
})
