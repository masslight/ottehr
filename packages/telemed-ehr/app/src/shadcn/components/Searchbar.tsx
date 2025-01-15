import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface SearchBarProps {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  className?: string
}

export function SearchBar({ 
  placeholder = "Search...", 
  value, 
  onChange,
  className 
}: SearchBarProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="pl-8"
      />
    </div>
  )
}