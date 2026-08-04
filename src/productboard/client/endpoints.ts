export const PRODUCTBOARD_API_BASE_URL = "https://api.productboard.com/v2"

/**
 * Absolute URL builders for the Productboard REST API.
 *
 * @see https://developer.productboard.com
 */
export const endpoints = {
    api: {
        notes: `${PRODUCTBOARD_API_BASE_URL}/notes`,

        noteCustomerRelationship: (noteId: string) =>
            `${PRODUCTBOARD_API_BASE_URL}/notes/${encodeURIComponent(noteId)}/relationships/customer`,

        notesWithFields: (fields: string) =>
            `${PRODUCTBOARD_API_BASE_URL}/notes?fields=${encodeURIComponent(fields)}`,

        entities: `${PRODUCTBOARD_API_BASE_URL}/entities`,

        entitiesSearch: `${PRODUCTBOARD_API_BASE_URL}/entities/search`,

        features: `${PRODUCTBOARD_API_BASE_URL}/entities?type[]=feature&fields=name`,

        noteConfiguration: (type: string) =>
            `${PRODUCTBOARD_API_BASE_URL}/notes/configurations/${encodeURIComponent(type)}`,
    },
} as const
