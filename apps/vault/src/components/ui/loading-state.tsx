interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 sm:py-12">
      <div className="border-primary mb-3 h-7 w-7 animate-spin rounded-full border-[3px] border-t-transparent" />
      <p className="text-muted-foreground text-sm font-medium">{message}</p>
    </div>
  )
}
