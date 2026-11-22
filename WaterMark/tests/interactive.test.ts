import { describe, expect, it } from 'vitest'
import { isEager, makeEager, subscribeEager } from '../src/scripting/lazy/eager'
import { makeBubbles, makeSchool, newDepth, shuffle } from '../src/scripting/sea/school'
import { HOVER_SCRAMBLE, TITLE_SCRAMBLE, scrambleDuration, scrambledChar } from '../src/scripting/text/scramble'

/** Small seeded random source so layouts are repeatable in tests. */
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

describe('evidence sea layout', () => {
  const kinds = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const

  it('gives every kind exactly one fish, in a shuffled order', () => {
    const school = makeSchool(kinds, seeded(3))
    expect(school.map((fish) => fish.kind).sort()).toEqual([...kinds])
    expect(school.map((fish) => fish.kind)).not.toEqual([...kinds])
  })

  it('spreads fish over depths and sends them both ways', () => {
    const school = makeSchool(kinds, seeded(9))
    const bands = new Set(school.map((fish) => Math.floor(fish.y * kinds.length)))
    expect(bands.size).toBe(kinds.length)
    expect(school.some((fish) => fish.dir === 1)).toBe(true)
    expect(school.some((fish) => fish.dir === -1)).toBe(true)
    for (const fish of school) {
      expect(fish.y).toBeGreaterThan(0)
      expect(fish.y).toBeLessThan(1)
      expect(fish.swim).toBeGreaterThan(10)
    }
  })

  it('brings a fish back at a new depth inside its own band', () => {
    const random = seeded(5)
    for (let i = 0; i < 50; i++) {
      const depth = newDepth(0.45, 7, random)
      expect(Math.floor(depth * 7)).toBe(3)
    }
    expect(shuffle([1, 2, 3, 4], seeded(1)).sort()).toEqual([1, 2, 3, 4])
    expect(makeBubbles(20, seeded(2))).toHaveLength(20)
  })
})

describe('title decrypt timings', () => {
  it('runs long enough on load to be seen, and quickly on hover', () => {
    expect(scrambleDuration('around you.'.length, TITLE_SCRAMBLE)).toBeGreaterThan(1500)
    expect(scrambleDuration('water'.length, HOVER_SCRAMBLE)).toBeLessThan(600)
    expect(scrambledChar('w', 0, HOVER_SCRAMBLE.settle, HOVER_SCRAMBLE)).toBe('w')
  })
})

describe('eager lazy sections', () => {
  it('notifies subscribers once and stays on', () => {
    let calls = 0
    const stop = subscribeEager(() => calls++)
    expect(isEager()).toBe(false)
    makeEager()
    makeEager()
    expect(isEager()).toBe(true)
    expect(calls).toBe(1)
    stop()
  })
})
