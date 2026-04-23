import * as React from "react"

import { cn } from "@/lib/utils"

function Alert({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="alert"
      className={cn(
        "group/alert relative flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm transition-all",
        className
      )}
      {...props}
    />
  )
}

function AlertTitle({
  className,
  ...props
}: React.ComponentProps<"h5">) {
  return (
    <h5
      className={cn("font-semibold", className)}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-sm [&_p]:leading-relaxed", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
