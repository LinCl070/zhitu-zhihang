import { CalendarDays } from 'lucide-react'

type DatePickerFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  required?: boolean
  disabled?: boolean
}

export function DatePickerField({
  id,
  label,
  value,
  onChange,
  min = '1958-01-01',
  max,
  required = false,
  disabled = false,
}: DatePickerFieldProps) {
  return (
    <label className="date-picker-field" htmlFor={id}>
      <span>{required && <i className="required-mark" aria-hidden="true">*</i>}{label}</span>
      <span className="date-picker-control">
        <CalendarDays size={18} aria-hidden="true" />
        <input
          id={id}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          min={min}
          max={max}
          required={required}
          disabled={disabled}
        />
      </span>
    </label>
  )
}
