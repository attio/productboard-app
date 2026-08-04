export type ProductboardFeature = {
    id: string
    name: string
}

export type ProductboardTag = {
    id: string
    name: string
}

export type ProductboardLinkRelationship = {
    type: "link"
    target: {
        id: string
    }
}
