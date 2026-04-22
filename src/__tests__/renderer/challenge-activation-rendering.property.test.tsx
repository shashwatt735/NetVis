// Feature: netvis-core, Property 13: Challenge activation rendering
// Validates: Requirements 11.2
// @vitest-environment jsdom

/**
 * Property 13: Challenge activation rendering
 *
 * For any Challenge in the challenge library, activating it must result in a
 * rendered panel that contains:
 *   (a) The challenge's title
 *   (b) The challenge's goal description
 *   (c) A mechanism to reveal the hint (button/collapsible)
 *   (d) A close button to deactivate the challenge
 *   (e) The panel only renders when activeChallengeId is not null
 *   (f) The panel does not render when activeChallengeId is null
 *
 * Validates: Requirement 11.2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'
import React from 'react'
import { renderWithStore, resetStore, mockElectronAPI, screen } from './test-utils'
import { ChallengePanel } from '../../renderer/src/components/ChallengePanel'
import { CHALLENGES, type Challenge } from '../../renderer/src/data/challenges'
import { useNetVisStore } from '../../renderer/src/store'

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Arbitrary that selects a valid challenge ID from the CHALLENGES array. */
const challengeIdArb = fc.constantFrom(...CHALLENGES.map((c) => c.id))

/** Arbitrary that selects a Challenge object from the CHALLENGES array. */
const challengeArb = fc.constantFrom(...CHALLENGES)

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStore()
  mockElectronAPI()
  vi.clearAllMocks()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Challenge activation rendering (P13)', () => {
  /**
   * Property 13a: When activeChallengeId is set to a valid challenge ID,
   * the ChallengePanel renders and displays the challenge's title.
   * Validates: Requirement 11.2
   */
  it('renders challenge title when challenge is activated', () => {
    fc.assert(
      fc.property(challengeArb, (challenge: Challenge) => {
        // Reset DOM between iterations
        document.body.innerHTML = ''

        // Activate the challenge
        useNetVisStore.setState({ activeChallengeId: challenge.id })

        // Render the panel
        renderWithStore(<ChallengePanel />)

        // Verify title is displayed
        expect(screen.getByText(challenge.title)).toBeInTheDocument()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 13b: When activeChallengeId is set to a valid challenge ID,
   * the ChallengePanel renders and displays the challenge's goal description.
   * Validates: Requirement 11.2
   */
  it('renders challenge goal when challenge is activated', () => {
    fc.assert(
      fc.property(challengeArb, (challenge: Challenge) => {
        // Reset DOM between iterations
        document.body.innerHTML = ''

        // Activate the challenge
        useNetVisStore.setState({ activeChallengeId: challenge.id })

        // Render the panel
        renderWithStore(<ChallengePanel />)

        // Verify goal is displayed
        expect(screen.getByText(challenge.goal)).toBeInTheDocument()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 13c: When activeChallengeId is set to a valid challenge ID,
   * the ChallengePanel renders a hint reveal button.
   * Validates: Requirement 11.2
   */
  it('renders hint reveal button when challenge is activated', () => {
    fc.assert(
      fc.property(challengeIdArb, (challengeId: string) => {
        // Reset DOM between iterations
        document.body.innerHTML = ''

        // Activate the challenge
        useNetVisStore.setState({ activeChallengeId: challengeId })

        // Render the panel
        renderWithStore(<ChallengePanel />)

        // Verify hint button is present (initially shows "Show Hint")
        expect(screen.getByText(/Show Hint/i)).toBeInTheDocument()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 13d: When activeChallengeId is set to a valid challenge ID,
   * the ChallengePanel renders a close button.
   * Validates: Requirement 11.2
   */
  it('renders close button when challenge is activated', () => {
    fc.assert(
      fc.property(challengeIdArb, (challengeId: string) => {
        // Reset DOM between iterations
        document.body.innerHTML = ''

        // Activate the challenge
        useNetVisStore.setState({ activeChallengeId: challengeId })

        // Render the panel
        renderWithStore(<ChallengePanel />)

        // Verify close button is present (aria-label="Close challenge")
        expect(screen.getByLabelText(/Close challenge/i)).toBeInTheDocument()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 13e: When activeChallengeId is null, the ChallengePanel
   * does not render any challenge content.
   * Validates: Requirement 11.2
   */
  it('does not render when activeChallengeId is null', () => {
    // Ensure activeChallengeId is null
    useNetVisStore.setState({ activeChallengeId: null })

    // Render the panel
    const { container } = renderWithStore(<ChallengePanel />)

    // Verify no challenge content is rendered (container should be empty or minimal)
    expect(container.textContent).toBe('')
  })

  /**
   * Property 13f: For any completed challenge, the panel displays a
   * completion indicator (trophy icon or "completed" text).
   * Validates: Requirement 11.2
   */
  it('displays completion indicator for completed challenges', () => {
    fc.assert(
      fc.property(challengeIdArb, (challengeId: string) => {
        // Reset DOM between iterations
        document.body.innerHTML = ''

        // Mark challenge as completed
        useNetVisStore.setState({
          activeChallengeId: challengeId,
          completedChallengeIds: [challengeId]
        })

        // Render the panel
        renderWithStore(<ChallengePanel />)

        // Verify completion indicator is present (aria-label="Completed")
        expect(screen.getByLabelText(/Completed/i)).toBeInTheDocument()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 13g: The panel renders with correct ARIA attributes for
   * accessibility (role, aria-label, aria-expanded on hint button).
   * Validates: Requirement 11.2 (accessibility)
   */
  it('renders with correct ARIA attributes', () => {
    fc.assert(
      fc.property(challengeIdArb, (challengeId: string) => {
        // Reset DOM between iterations
        document.body.innerHTML = ''

        // Activate the challenge
        useNetVisStore.setState({ activeChallengeId: challengeId })

        // Render the panel
        renderWithStore(<ChallengePanel />)

        // Verify hint button has aria-expanded attribute
        const hintButton = screen.getByText(/Show Hint/i)
        expect(hintButton).toHaveAttribute('aria-expanded', 'false')

        // Verify close button has aria-label
        const closeButton = screen.getByLabelText(/Close challenge/i)
        expect(closeButton).toHaveAttribute('aria-label')
      }),
      { numRuns: 100 }
    )
  })
})
