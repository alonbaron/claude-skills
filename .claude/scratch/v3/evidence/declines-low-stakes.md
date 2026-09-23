# declines-low-stakes

Aggregates: {"score":1,"passRate":1,"scoreWithout":1,"passRateWithout":1,"delta":0}

## with#0 score=1 turns=1

### grader `declines-panel-result` passed=true scored=true withOnly=false
judge votes: PASS PASS PASS

<evidence>
Pick date-fns. For a Next.js app it's the better default, and since you said both seem fine, the tiebreakers below are what should settle it.

- **Native Date objects.** date-fns takes and returns plain `Date`, so nothing wrapper-shaped leaks into props, serialized server data, or your own types. dayjs hands you `Dayjs` instances, which you end up converting at boundaries.
- **No global plugin registration.** dayjs extends itself via `dayjs.extend(plugin)`, which is mutable module state. With Next.js splitting code across server components, client components, and route handlers, it's easy to end up formatting in a file where the plugin wasn't registered. date-fns is just functions you import.
- **Tree-shaking fits the bundler.** Each date-fns function is a separate ESM export, so a formatting-only app ships only `format` and friends. dayjs is tiny anyway, so this isn't decisive, but it's a point in the same direction.
- **Time zones are cleaner.** The official `@date-fns/tz` package handles zones without a plugin chain. dayjs needs both the utc and timezone plugins registered in the right order.
- **Same for i18n.** Both do locales, but date-fns locales are also plain imports, so they tree-shake and work the same in server and client code.

The one thing dayjs does better is the chainable, Moment-style API. If you or your team have Moment muscle memory and mostly do `.add(1, 'day').startOf('week')` style manipulation, that's a fair reason to go the other way. For "formatting timestamps" it doesn't matter.

One alternative worth a glance before adding either: if all you need is display formatting, `Intl.DateTimeFormat` is built in, locale-aware, and zero dependencies. Reach for date-fns as soon as you need parsing, relative time like "3 minutes ago", or arithmetic.
</evidence>

### grader `no-subagents-spawned` passed=true scored=true withOnly=false
Agent called 0x (expected 0..0)

### grader `skill-fired` passed=true scored=false withOnly=true
Skill called 0x (expected 0..∞)

## with#1 score=1 turns=1

### grader `declines-panel-result` passed=true scored=true withOnly=false
judge votes: PASS PASS PASS

<evidence>
Use date-fns. For a Next.js app it fits better, and the choice is reversible in an afternoon anyway, so pick and move on.

Why date-fns edges it out here:

- **Tree-shaking.** Every function is a separate ESM import, so a couple of `format` calls cost a few KB. dayjs is small as a whole, but you always ship the core plus whatever plugins you register.
- **No global mutation.** dayjs plugins and locales are registered globally with `dayjs.extend`, which gets awkward across server components, client components, and route boundaries. date-fns functions are pure and take options per call, so nothing needs to run first.
- **TypeScript.** date-fns v3+ is written in TypeScript with accurate types. dayjs types are fine but plugin augmentation is clunkier.
- **Native Date.** date-fns works on plain Date objects, which is what you already get from your database client, API responses, and React props.

One thing to consider before either: if all you need is displaying timestamps in a few common formats, the built-in `Intl.DateTimeFormat` handles locale-aware output with no dependency at all. Reach for date-fns when you also need parsing, relative time like "3 minutes ago", or arithmetic like adding days.
</evidence>

### grader `no-subagents-spawned` passed=true scored=true withOnly=false
Agent called 0x (expected 0..0)

### grader `skill-fired` passed=true scored=false withOnly=true
Skill called 0x (expected 0..∞)

## without#0 score=1 turns=1

### grader `declines-panel-result` passed=true scored=true withOnly=false
judge votes: PASS PASS PASS

<evidence>
Pick date-fns. Both work, and the difference is small enough that you should stop weighing it and move on, but here is why I would default to date-fns in a Next.js app:

- **Tree-shaking fits Next.js well.** You import only the functions you use, so a handful of formatting calls costs a few KB. Dayjs is tiny too, but each plugin you enable adds up and has to be registered globally.
- **Plain Date objects, no wrapper.** Functions take and return native dates, which plays nicely with server components, serialization across the server/client boundary, and TypeScript. Dayjs wraps everything in its own object, which you then unwrap.
- **Ecosystem alignment.** react-day-picker, shadcn/ui's date components, and many Next.js examples already use date-fns, so you avoid two date libraries later.
- **Locale and timezone story is cleaner.** Locales are imported per-locale, and the `@date-fns/tz` package handles zones without plugin registration order surprises.

Choose dayjs instead if your team already knows Moment's chaining API and wants a near drop-in, or if you're migrating from Moment.

One more option worth a second of thought: if all you need is displaying timestamps, the built-in `Intl.DateTimeFormat` covers formatting and localization with zero dependencies. Reach for date-fns when you also need parsing, arithmetic, or relative time like "3 minutes ago."
</evidence>

### grader `no-subagents-spawned` passed=true scored=true withOnly=false
Agent called 0x (expected 0..0)

## without#1 score=1 turns=2

### grader `declines-panel-result` passed=true scored=true withOnly=false
judge votes: PASS PASS PASS

<evidence>
Nothing in the working directory tips it either way, so this comes down to the libraries themselves.

**Pick date-fns.** For a Next.js app the deciding factor is tree-shaking. date-fns is a collection of pure functions, so importing `format` pulls in only that function. dayjs is a single class with plugins, so you carry the whole core plus each plugin you enable, and its plugin registration is a global side effect that gets awkward with React Server Components and multiple entry points.

Other reasons it fits Next.js better:

- **Native Date objects.** date-fns takes and returns plain Dates, which serialize cleanly across the server/client boundary. dayjs wraps everything in its own object, which you cannot pass from a server component to a client component without converting.
- **Immutability by default.** Every date-fns call returns a new Date. dayjs is also immutable, so this is a wash, but both beat Moment here.
- **Time zones.** If you ever need zoned formatting, `@date-fns/tz` slots in cleanly. dayjs needs two plugins (utc and timezone) that have a history of edge-case bugs.
- **Locales.** date-fns locales are separate imports, so you ship only the ones you use. dayjs locales work similarly, so again a wash.

Where dayjs wins: if you or your team already know the Moment API, dayjs is a near drop-in and the chainable style reads more naturally for people coming from that world. That is a real ergonomic benefit, but it is a smaller one than the bundling and serialization points above.

One more option worth a sentence: if all you need is formatting for display, the built-in `Intl.DateTimeFormat` handles a lot of cases with zero dependencies and correct locale output. Reach for date-fns when you also need parsing, arithmetic, or relative time like "3 minutes ago".
</evidence>

### grader `no-subagents-spawned` passed=true scored=true withOnly=false
Agent called 0x (expected 0..0)
