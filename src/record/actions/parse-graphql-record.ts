export type ParsedPerson = {
    name: string
    email: string
}

export type ParsedCompany = {
    name: string
    domain: string
}

function firstFromGraphqlArray(values: unknown, objectKey: string): string {
    if (!Array.isArray(values) || values.length === 0) {
        return ""
    }

    const first = values[0]

    if (typeof first === "string") {
        return first.trim()
    }

    if (first && typeof first === "object" && objectKey in first) {
        const value = (first as Record<string, string | undefined>)[objectKey]
        return typeof value === "string" ? value.trim() : ""
    }

    return ""
}

export function parsePersonFromGraphql(
    person:
        | {
              name?: {full_name?: string | null} | null
              email_addresses?: unknown
          }
        | null
        | undefined
): ParsedPerson | null {
    if (!person) {
        return null
    }

    const name = person.name?.full_name?.trim() ?? ""
    const email = firstFromGraphqlArray(person.email_addresses, "email_address")

    if (!name && !email) {
        return null
    }

    return {name, email}
}

export function parseCompanyFromGraphql(
    company:
        | {
              name?: string | null
              domains?: unknown
          }
        | null
        | undefined
): ParsedCompany | null {
    if (!company) {
        return null
    }

    const name = company.name?.trim() ?? ""
    const domain = firstFromGraphqlArray(company.domains, "domain")

    if (!name && !domain) {
        return null
    }

    return {name, domain}
}
