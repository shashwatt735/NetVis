/**
 * ChallengePanel — Guided educational challenges.
 * Req 11.1, 11.2, 11.3, 11.4, 11.5
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import { Trophy, ChevronDown, ChevronRight, X } from 'lucide-react'
import { useNetVisStore } from '../store'
import { getChallengeById } from '../data/challenges'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { toast } from 'sonner'

/**
 * ChallengePanel displays the active challenge with goal, hint, and success evaluation.
 * Evaluates success criteria on 500ms debounced interval (Req 11.3).
 * Persists completion to Settings_Store (Req 11.5).
 */
export function ChallengePanel(): React.JSX.Element {
  const activeChallengeId = useNetVisStore((s) => s.activeChallengeId)
  const completedChallengeIds = useNetVisStore((s) => s.completedChallengeIds)
  const filteredPackets = useNetVisStore((s) => s.filteredPackets)
  const filterExpression = useNetVisStore((s) => s.filterExpression)
  const activateChallenge = useNetVisStore((s) => s.activateChallenge)
  const setCompletedChallenges = useNetVisStore((s) => s.setCompletedChallenges)

  const [hintRevealed, setHintRevealed] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const evaluationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEvaluationRef = useRef<number>(0)
  const completionInFlightRef = useRef<string | null>(null)

  const activeChallenge = activeChallengeId ? getChallengeById(activeChallengeId) : null

  const handleChallengeSuccess = useCallback(async (id: string, title: string): Promise<void> => {
    const currentCompletedIds = useNetVisStore.getState().completedChallengeIds

    if (currentCompletedIds.includes(id) || completionInFlightRef.current === id) {
      return
    }

    completionInFlightRef.current = id

    try {
      const newCompletedIds = Array.from(new Set([...currentCompletedIds, id]))
      await window.electronAPI.setSettings({ completedChallenges: newCompletedIds })

      setCompletedChallenges(newCompletedIds)
      activateChallenge(null)
      setHintRevealed(false)

      toast.success(`Challenge Complete: ${title}`, {
        description: 'Great work! Your progress has been saved.',
        duration: 5000,
        icon: <Trophy size={20} style={{ color: 'var(--proto-dns)' }} />
      })
    } catch (error) {
      console.error('Failed to persist challenge completion:', error)
    } finally {
      if (completionInFlightRef.current === id) {
        completionInFlightRef.current = null
      }
    }
  }, [activateChallenge, setCompletedChallenges])

  // Debounced success criteria evaluation (Req 11.3: at most every 500ms)
  useEffect(() => {
    if (!activeChallenge) {
      if (evaluationTimerRef.current) {
        clearTimeout(evaluationTimerRef.current)
        evaluationTimerRef.current = null
      }
      setIsEvaluating(false)
      return
    }

    if (evaluationTimerRef.current) {
      clearTimeout(evaluationTimerRef.current)
    }

    evaluationTimerRef.current = setTimeout(() => {
      void (async () => {
        const now = Date.now()
        if (now - lastEvaluationRef.current < 500) {
          return
        }

        lastEvaluationRef.current = now
        setIsEvaluating(true)

        try {
          const success = activeChallenge.successCriteria(filteredPackets, filterExpression)
          if (success) {
            await handleChallengeSuccess(activeChallenge.id, activeChallenge.title)
          }
        } catch (error) {
          console.error('Challenge evaluation error:', error)
        } finally {
          setIsEvaluating(false)
        }
      })()
    }, 500)

    return () => {
      if (evaluationTimerRef.current) {
        clearTimeout(evaluationTimerRef.current)
      }
    }
  }, [activeChallenge, filteredPackets, filterExpression, handleChallengeSuccess])

  const handleClose = (): void => {
    activateChallenge(null)
    setHintRevealed(false)
  }

  if (!activeChallenge) {
    return <></>
  }

  const isCompleted = completedChallengeIds.includes(activeChallenge.id)

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        width: 360,
        maxHeight: '60vh',
        zIndex: 1000,
        animation: 'slideInFromBottom 200ms ease-out'
      }}
    >
      <Card
        style={{
          backgroundColor: 'var(--nv-bg-surface-1)',
          border: '1px solid var(--nv-border-default)',
          boxShadow: 'var(--nv-shadow-lg)',
          borderRadius: 'var(--nv-radius-lg)',
          overflow: 'hidden'
        }}
      >
        <CardHeader
          style={{
            padding: '12px 16px',
            paddingBottom: 10,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--nv-border-subtle)'
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <CardTitle
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--nv-text-primary)',
                marginBottom: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {activeChallenge.title}
              {isCompleted && (
                <Trophy
                  size={14}
                  style={{ color: 'var(--proto-dns)', flexShrink: 0 }}
                  aria-label="Completed"
                />
              )}
            </CardTitle>
            <CardDescription
              style={{
                fontSize: 12,
                color: 'var(--nv-text-tertiary)'
              }}
            >
              {isCompleted ? 'Challenge completed!' : 'Active challenge'}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            aria-label="Close challenge"
            style={{
              padding: 4,
              height: 24,
              width: 24,
              flexShrink: 0,
              marginTop: -2
            }}
          >
            <X size={14} />
          </Button>
        </CardHeader>

        <CardContent style={{ padding: '12px 16px' }}>
          {/* Goal description */}
          <div style={{ marginBottom: 12 }}>
            <h4
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--nv-text-tertiary)',
                marginBottom: 6
              }}
            >
              Goal
            </h4>
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--nv-text-primary)'
              }}
            >
              {activeChallenge.goal}
            </p>
          </div>

          {/* Hint (reveal on demand) - Req 11.2 */}
          <Collapsible open={hintRevealed} onOpenChange={setHintRevealed}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                  marginBottom: hintRevealed ? 8 : 0,
                  height: 30,
                  fontSize: 12
                }}
                aria-expanded={hintRevealed}
                aria-label={hintRevealed ? 'Hide hint' : 'Show hint'}
              >
                <span style={{ fontWeight: 500 }}>
                  {hintRevealed ? 'Hide Hint' : 'Show Hint'}
                </span>
                {hintRevealed ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--nv-bg-surface-2)',
                borderRadius: 'var(--nv-radius-md)',
                border: '1px solid var(--nv-border-subtle)'
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.55,
                  color: 'var(--nv-text-secondary)',
                  margin: 0
                }}
              >
                {activeChallenge.hint}
              </p>
            </CollapsibleContent>
          </Collapsible>

          {/* Evaluation status indicator */}
          {isEvaluating && (
            <div
              style={{
                marginTop: 10,
                padding: '6px 10px',
                fontSize: 11,
                color: 'var(--nv-text-tertiary)',
                textAlign: 'center',
                fontStyle: 'italic',
                backgroundColor: 'var(--nv-bg-surface-2)',
                borderRadius: 'var(--nv-radius-sm)'
              }}
              role="status"
              aria-live="polite"
            >
              Evaluating…
            </div>
          )}
        </CardContent>
      </Card>

      <style>{`
        @keyframes slideInFromBottom {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
