/**
 * ChallengeSelector - Dropdown menu for activating guided challenges.
 * Req 11.1, 11.2
 */

import { Check, Trophy } from 'lucide-react'
import type React from 'react'
import { CHALLENGES } from '../data/challenges'
import { useNetVisStore } from '../store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import { Button } from './ui/button'

/**
 * ChallengeSelector displays a dropdown menu of available challenges.
 * Completed challenges are marked with a checkmark.
 */
export function ChallengeSelector(): React.JSX.Element {
  const activateChallenge = useNetVisStore((s) => s.activateChallenge)
  const completedChallengeIds = useNetVisStore((s) => s.completedChallengeIds)
  const activeChallengeId = useNetVisStore((s) => s.activeChallengeId)

  const toolbarButtonStyle: React.CSSProperties = {
    height: 'calc(var(--nv-control-height) - 4px)',
    minWidth: 'calc(var(--nv-control-height) - 4px)',
    padding: '0 var(--nv-space-2)',
    gap: 'var(--nv-space-2)'
  }

  const handleSelectChallenge = (id: string): void => {
    if (activeChallengeId === id) {
      activateChallenge(null)
    } else {
      activateChallenge(id)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Challenges"
          title="Guided challenges"
          style={toolbarButtonStyle}
        >
          <Trophy size={15} aria-hidden />
          <span style={{ fontSize: 'var(--nv-text-label)', fontWeight: 500 }}>Challenges</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        style={{
          width: 320,
          maxHeight: 460,
          padding: 4,
          overflowY: 'auto'
        }}
      >
        <DropdownMenuLabel
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--nv-text-primary)',
            padding: '8px 10px 6px'
          }}
        >
          Guided Challenges
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {CHALLENGES.map((challenge) => {
          const isCompleted = completedChallengeIds.includes(challenge.id)
          const isActive = activeChallengeId === challenge.id

          return (
            <DropdownMenuItem
              key={challenge.id}
              onClick={() => handleSelectChallenge(challenge.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                backgroundColor: isActive ? 'var(--nv-bg-surface-1)' : undefined,
                borderRadius: 'var(--nv-radius-md)',
                minHeight: 64
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {isCompleted && (
                  <Check size={16} style={{ color: 'var(--proto-dns)' }} aria-label="Completed" />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: 'var(--nv-text-primary)',
                    marginBottom: 4
                  }}
                >
                  {challenge.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--nv-text-tertiary)',
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical'
                  }}
                >
                  {challenge.goal}
                </div>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
