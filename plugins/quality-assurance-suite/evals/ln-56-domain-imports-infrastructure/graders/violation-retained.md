---
type: regex
target: { source: file, path: orders/domain/order.py }
pattern: 'from orders\.infrastructure\.sqlite_repository import SqliteOrderRepository[\s\S]*SqliteOrderRepository\("orders\.db"\)\.save\(order\)'
---
