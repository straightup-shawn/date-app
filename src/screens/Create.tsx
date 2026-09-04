import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { AppShell } from '@/components/shell/AppShell'
import { CollapsingHeader } from '@/components/shell/CollapsingHeader'
import { PageTransition } from '@/components/shell/PageTransition'
import { ThemeToggle } from '@/components/shell/ThemeToggle'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ChoiceChip } from '@/components/ui/ChoiceChip'
import { useToast } from '@/components/ui/Toast'
import { generateFlow } from '@/lib/api'
import { GenerationProgress } from '@/screens/parts/GenerationProgress'
import type {
  CreateInput,
  ExperiencePreference,
  Occasion,
  TimeWindow,
  TravelPreference,
} from '@/lib/types'

const PREFERENCE_CHIPS = [
  { id: 'mostly_indoor', label: 'Mostly indoors' },
  { id: 'quiet', label: 'Quiet' },
  { id: 'free_cheap', label: 'Free / cheap' },
  { id: 'alcohol_free', label: 'Alcohol-free' },
  { id: 'no_long_waits', label: 'No long waits' },
]

/**
 * Create flow (Section 2A.7): short, progressive, large choices.
 * Fits on one mobile screen — no artificial multi-step wizard.
 */
export function Create() {
  const navigate = useNavigate()
  const toast = useToast()

  const [area, setArea] = useState('')
  const [occasion, setOccasion] = useState<Occasion>('casual')
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('evening')
  const [experience, setExperience] = useState<ExperiencePreference>('surprise_me')
  const [travel, setTravel] = useState<TravelPreference>('short_ride_ok')
  const [pax, setPax] = useState(2)
  const [budget, setBudget] = useState(150)
  const [prefs, setPrefs] = useState<string[]>([])
  const [freeText, setFreeText] = useState('')
  const [generating, setGenerating] = useState(false)

  const togglePref = (id: string) =>
    setPrefs((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  async function onGenerate() {
    if (!area.trim()) {
      toast.show('Tell us where — a city or neighborhood.', 'error')
      return
    }
    setGenerating(true)
    const input: CreateInput = {
      neighborhood: area.trim(),
      occasion,
      pax,
      time_window: timeWindow,
      budget_mode: 'total',
      budget_myr: budget,
      travel_preference: travel,
      experience_preference: experience,
      preferences: prefs,
      free_text: freeText.trim() || undefined,
    }

    const res = await generateFlow(input)

    if (res.ok) {
      navigate(`/pass/${res.data.share_hash}`)
      return
    }

    setGenerating(false)
    // Keep inputs; show a human explanation (Section 2A.14).
    const msg =
      res.error.message ??
      "Couldn't build a good route with these constraints. Try adjusting them."
    const suffix = res.error.relaxation_suggestion ? ` ${res.error.relaxation_suggestion}` : ''
    toast.show(`${msg}${suffix}`, 'error')
  }

  if (generating) {
    return (
      <AppShell hideDock>
        <GenerationProgress />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <PageTransition>
        <CollapsingHeader
          title="Create a Date Pass"
          compactTitle="Create"
          showBack
          right={<ThemeToggle />}
        />

        <div className="space-y-6 px-5">
          <Field label="Where?">
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              maxLength={80}
              placeholder="City or neighborhood — e.g. Bangsar, Shibuya, SoHo"
              className="w-full rounded-control border border-border bg-surface p-3 text-body text-text-primary placeholder:text-text-tertiary"
              aria-label="Area"
            />
          </Field>

          <Field label="What kind of date?">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['first_date', 'First Date'],
                  ['anniversary', 'Anniversary'],
                  ['casual', 'Casual'],
                  ['casual_group', 'Group'],
                ] as [Occasion, string][]
              ).map(([val, label]) => (
                <ChoiceChip key={val} selected={occasion === val} onClick={() => setOccasion(val)}>
                  {label}
                </ChoiceChip>
              ))}
            </div>
          </Field>

          <Field label="When?">
            <SegmentedControl<TimeWindow>
              label="time window"
              value={timeWindow}
              onChange={setTimeWindow}
              options={[
                { value: 'afternoon', label: 'Afternoon' },
                { value: 'evening', label: 'Evening' },
                { value: 'late_night', label: 'Late Night' },
              ]}
            />
          </Field>

          <Field label="What are you in the mood for?">
            <SegmentedControl<ExperiencePreference>
              label="experience"
              value={experience}
              onChange={setExperience}
              options={[
                { value: 'food_focused', label: 'Food' },
                { value: 'activity_focused', label: 'Activity' },
                { value: 'explore', label: 'Explore' },
                { value: 'surprise_me', label: 'Surprise' },
              ]}
            />
          </Field>

          <Field label={`How many people? (${pax})`}>
            <input
              type="range"
              min={1}
              max={10}
              value={pax}
              onChange={(e) => setPax(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
              aria-label="Number of people"
            />
          </Field>

          <Field label={`Total budget: RM ${budget}`}>
            <input
              type="range"
              min={40}
              max={800}
              step={10}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
              aria-label="Total budget in MYR"
            />
            <p className="mt-1 text-meta text-text-tertiary tabular">
              ≈ RM {Math.round(budget / pax)} per person
            </p>
          </Field>

          <Field label="Getting around">
            <SegmentedControl<TravelPreference>
              label="travel"
              value={travel}
              onChange={setTravel}
              options={[
                { value: 'walkable', label: 'Mostly Walkable' },
                { value: 'short_ride_ok', label: 'Short Ride OK' },
              ]}
            />
          </Field>

          <Field label="Any preferences? (optional)">
            <div className="flex flex-wrap gap-2">
              {PREFERENCE_CHIPS.map((c) => (
                <ChoiceChip key={c.id} selected={prefs.includes(c.id)} onClick={() => togglePref(c.id)}>
                  {c.label}
                </ChoiceChip>
              ))}
            </div>
          </Field>

          <Field label="Anything else? (optional)">
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              maxLength={280}
              rows={2}
              placeholder="e.g. somewhere chill where we can actually talk"
              className="w-full resize-none rounded-control border border-border bg-surface p-3 text-body text-text-primary placeholder:text-text-tertiary"
            />
          </Field>

          <div className="pt-1">
            <Button fullWidth onClick={onGenerate}>
              <Sparkles size={18} aria-hidden />
              Generate
            </Button>
          </div>
        </div>
      </PageTransition>
    </AppShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-meta font-semibold text-text-secondary">{label}</label>
      {children}
    </div>
  )
}
