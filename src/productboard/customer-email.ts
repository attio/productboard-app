export function resolveProductboardCustomerEmail({
    personEmail,
    companyDomain,
}: {
    personEmail: string
    companyDomain?: string
}): string | undefined {
    if (personEmail.trim() !== "") {
        return personEmail.trim()
    }

    if (companyDomain && companyDomain.trim() !== "") {
        return `feedback@${companyDomain.trim()}`
    }

    return undefined
}
