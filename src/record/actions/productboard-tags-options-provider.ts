import type {PlainComboboxOptionsProvider} from "attio/client"

import {createLogger} from "../../utils/logger"
import getProductboardTags from "./get-productboard-tags.server"

const logger = createLogger("productboard-tags-options")

/**
 * ComboboxOptionsProvider for Productboard tags
 */
export const productboardTagsOptionsProvider: PlainComboboxOptionsProvider = {
    getOption: async (value: string) => {
        try {
            const tags = await getProductboardTags()
            const tag = tags.find((t) => t.name === value)
            return tag
                ? {
                      label: tag.name,
                  }
                : undefined
        } catch (error) {
            logger.error("Error getting Productboard tag:", error)
            return undefined
        }
    },

    search: async (query: string) => {
        try {
            const allTags = await getProductboardTags()

            if (!allTags || allTags.length === 0) {
                return []
            }

            const normalizedQuery = query.trim().toLowerCase()
            const filteredTags = normalizedQuery
                ? allTags.filter((tag) => tag.name.toLowerCase().includes(normalizedQuery))
                : allTags

            return filteredTags.map((tag) => ({
                value: tag.name,
                label: tag.name,
            }))
        } catch (error) {
            logger.error("Error searching Productboard tags:", error)
            return []
        }
    },
}
