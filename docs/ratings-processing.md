# Descarga y cálculo de ratings

`history:import`, `history:import-player` y la actualización del historial desde la
aplicación guardan resultados y dejan pendientes los ratings afectados. No ejecutan
Glicko-2. El campo `ratingPeriodsProcessed` se conserva y devuelve `0` en esas
operaciones.

Procesar pendientes, sin invalidar periodos ya completados:

```powershell
npm.cmd run ratings:process
```

Procesar un lote acotado o medir un periodo:

```powershell
npm.cmd run ratings:process -- --max-periods=1
```

El comando emite tiempos de lectura, cálculo y persistencia por periodo. Cada
periodo se confirma en su propia transacción; una nueva ejecución continúa desde
el pendiente más antiguo. El proceso termina cuando alcanza el límite indicado o
no quedan pendientes. No es un servicio residente.

Cada periodo nuevo guarda checkpoints únicamente para los jugadores que han
competido en él. La desviación por inactividad se reconstruye al leer el siguiente
periodo, con la misma fórmula Glicko-2 que aplicaría un snapshot denso. Así el
trabajo y las escrituras dependen del tamaño del torneo y no del total histórico
de jugadores. Los snapshots densos anteriores siguen siendo válidos y se usan
como punto de partida; esta migración no los elimina.

Un bloqueo de sesión en PostgreSQL impide ejecutar dos procesadores. Un bloqueo
transaccional común coordina el guardado de torneos, la preparación de una
reconstrucción y cada periodo de cálculo. Las descargas de red pueden avanzar
mientras se calculan ratings; su guardado espera, como máximo, la transacción en
curso, salvo errores o esperas externas de la base de datos. Si una importación
invalida el periodo cacheado, el procesador recarga los ratings antes de continuar.

Los snapshots anteriores se conservan. Las consultas de ratings y puntuaciones
anuales combinan snapshots densos y checkpoints dispersos y excluyen los periodos
pendientes; la actividad y los resultados siguen disponibles. La fecha del último
rating completado puede ser anterior al historial ya importado.

`ratings:rebuild` vuelve a marcar todo pendiente y se reserva para reconstrucciones
expresas. No se necesita para reanudar la cola habitual.

La tarea «Migrar torneos Start.gg» descarga primero su lote y ejecuta después
`ratings:process -- --max-periods=100`. Los pendientes de Glicko-2 no son una
condición para detener futuras descargas.

Las descargas que comparten token reservan cada petición en PostgreSQL con una
separación de 875 ms, equivalente a un máximo teórico de 68,6 peticiones por
minuto. Las páginas de sets solicitan 80 elementos. El importador guarda el cursor
de página y torneo por intervalo; una ejecución posterior reanuda exactamente el
punto pendiente. `history:import -- --refresh` ignora un intervalo ya completado y
lo vuelve a recorrer expresamente.
