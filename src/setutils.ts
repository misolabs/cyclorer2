export const SetUtils = {
    difference<T>(a: Set<T>, b: Set<T>) {
        return new Set([...a].filter(x => !b.has(x)))
    },

    intersection<T>(a: Set<T>, b: Set<T>) {
        return new Set([...a].filter(x => b.has(x)))
    }
}