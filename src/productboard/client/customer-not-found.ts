type CustomerNotFoundCheckable = {
    apiError?: {
        status?: number
        code?: string
        detail?: string
    }
}

function isCustomerNotFoundDetail(detail: string): boolean {
    const normalizedDetail = detail.toLowerCase()

    return (
        normalizedDetail.includes("customer with email") ||
        normalizedDetail.includes("customer with id") ||
        (normalizedDetail.includes("customer") && normalizedDetail.includes("not found"))
    )
}

export function isCustomerNotFoundError(error: CustomerNotFoundCheckable): boolean {
    const apiError = error.apiError
    if (!apiError) return false

    if (apiError.detail && isCustomerNotFoundDetail(apiError.detail)) return true

    if (apiError.status === 404) {
        return apiError.code === "resource.notFound" || apiError.code === undefined
    }

    return false
}
