// components/YearRangeSlider.tsx
'use client'

import * as Slider from '@radix-ui/react-slider'

interface YearRangeSliderProps {
  min: number
  max: number
  step?: number
  value: [number, number]
  onValueChange: (value: [number, number]) => void
}

export function YearRangeSlider({
  min, max, step = 1, value, onValueChange
}: YearRangeSliderProps) {
  return (
    <Slider.Root
      className="relative flex w-full touch-none select-none items-center"
      value={value}
      min={min}
      max={max}
      step={step}
      onValueChange={val => onValueChange(val as [number, number])}
      minStepsBetweenThumbs={1}
    >
      <Slider.Track
        className="relative h-2 w-full grow overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--color-surface-2)' }}
      >
        <Slider.Range
          className="absolute h-full rounded-full"
          style={{ backgroundColor: 'var(--color-primary)' }}
        />
      </Slider.Track>

      <Slider.Thumb
        className="block h-5 w-5 rounded-full shadow-md transition-colors focus:outline-none"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '2px solid var(--color-primary)',
        }}
        aria-label="Minimum year"
      />
      <Slider.Thumb
        className="block h-5 w-5 rounded-full shadow-md transition-colors focus:outline-none"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '2px solid var(--color-primary)',
        }}
        aria-label="Maximum year"
      />
    </Slider.Root>
  )
}