---
type: regex
target: { source: file, path: handler.cs }
pattern: '^//\ Registered\ IExceptionHandler\ excerpt;\ default\ ExceptionHandlerOptions\.\nlogger\.LogError\(exception,\ "Request\ failed"\);\nhttpContext\.Response\.StatusCode\ =\ 500;\nawait\ httpContext\.Response\.WriteAsJsonAsync\(new\ \{\ code\ =\ "internal_error"\ \}\);\nreturn\ true;\n$'
flags: s
---
