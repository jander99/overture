# Overture: a vision

This document describes what overture is. It is intentionally written
without code, without flag names, and without file paths. The intent is
to keep a single, stable picture of the product that the implementation
can refer back to when specific questions get hard.

Other documents cover mechanics. This one is the _why_.

## What overture is

Overture is a small, fast command-line tool that keeps a single human's
Model Context Protocol (MCP) configuration in sync across the half-dozen
or so coding clients installed on one machine.

It does this by reading the human's declared intent from a single
canonical document, and applying that intent to each client in that
client's native configuration format. The clients are receivers of
intent. Overture is the mechanism that delivers the intent to each
client. The clients do not talk to each other; overture does not talk
to a network service; nothing leaves the machine.

The product's success looks like forgetfulness. The human runs two
commands per year: one when they set up a new machine, and one when
they install a new client. The rest of the time, overture is not
something they think about.

## What overture is not

Overture is not a configuration management framework. It does not have
profiles, inheritance, validation-as-code, or a plugin system. It does
not run as a service, daemon, or background process. It does not talk
to a remote registry of "popular" MCP servers. It does not maintain a
project-level config separate from the user's config. It does not
support teams, shared configs, or audit trails.

Overture does not pick winners. When two clients disagree, overture
asks. It does not pick the "most popular" version, the "most recently
modified" version, or the version that some other tool thinks is
correct. The human is the only authority the product acknowledges.

Overture is not a package manager. It does not install MCP servers, it
does not manage their versions, and it does not have an opinion about
which servers the human should run. Skills management — installing or
updating Agent Skills from a remote source — is a future seam in the
config schema but is not a feature the product implements today, and
may never.

## The user and the moment

One human. One machine. The moments that matter are small and
infrequent:

- The moment of "I just installed a new client, and I want my MCP
  setup to be there without me having to copy-paste anything."
- The moment of "I'm about to wipe this laptop, and I want to know
  exactly what I'll need to recreate to get back to the same state."
- The moment of "I haven't touched this in eight months. Does it
  still work? What does it think I have?"

The product is built to be there for those three moments and to be
silent the rest of the time. The user is a developer who already has
a working setup and is doing one of: setting up a new machine,
adding a new client, or coming back after a long absence. They are
not a beginner. They do not need onboarding. They need a thing that
gets out of the way.

## The mental model

Clients are receivers of intent, not peers of each other. The user's
canonical-intent document is the only authority in the system. The
clients mirror the document. Overture is the seatbelt between the
document and each client: it holds the document, it holds the
client, and it makes the transfer careful.

When the user runs a write, they are not "syncing" two clients
together. They are applying their intent to each client. The
directionality is one-way: from the human's intent, through
overture, to each client. The clients do not know about each other
and do not need to.

When two clients have different configurations, that is not a
"conflict" to be resolved. It is information. The user might have a
reason. Overture does not second-guess the user. If the user has not
expressed an opinion, the product asks. If the user has expressed an
opinion, the product applies it.

## The behaviors

Overture is described by what it does, not what it is. The product
has four behaviors, and they are described here in the order a new
user will encounter them.

**Read.** Overture can look at every client on the machine and report
what each one has, in human-readable terms, in one command. The
output is a comparison between the user's declared intent and the
current state across every installed client. It does not require the
canonical-intent document to exist yet. It is a read-only operation.
It never modifies any file on the machine.

**Bootstrap.** The first time the user runs overture, they do not have
a canonical-intent document. The clients do. Overture reads every
client's MCP configuration, deduplicates by server identity, and
writes the result to the canonical-intent document. The user is asked
to confirm or correct any conflicts that arise during the dedupe.
After bootstrap, the canonical-intent document is the source of
authority. Bootstrap is a one-time operation; the product does not
offer to re-bootstrap later.

**Apply.** When the user has a canonical-intent document, overture can
apply it to every detected client. The application is careful:
nothing outside the MCP subtree of each client's configuration is
touched; clients that have additional MCPs not in the canonical
document are left as-is; the user sees a preview of every change
before it is written to disk. Apply is the production behavior of
the product. It is the second of the two commands a typical user
runs in a year.

**Undo.** Every change the product makes to a client's configuration
is recoverable by a human without specialized tooling. A
configuration file that overture has modified has a recent backup
alongside it. A log of every change is preserved. The recovery path
is a `mv` and a `cat`. The product is built so that the worst-case
outcome of a misapplied intent is "the human copies a file back from
a sibling directory."

## Invariants

These are the things that must not change as the product grows.
Specific implementation details will move around; these will not.

- **The canonical-intent document is the only authority.** Clients
  mirror it. Overture does not infer authority from a client's
  contents once the document exists. The document was created by
  the human (or with the human's explicit consent during bootstrap)
  and the human is the only one who edits it after that.

- **Keys outside the MCP subtree in each client's configuration file
  are preserved byte-for-byte.** Overture modifies a single,
  well-defined location in each client. Everything else — comments,
  formatting, ordering, unrelated configuration keys, hand-edits —
  is left as the human wrote it.

- **MCPs that exist in a client but not in the canonical-intent
  document are never removed, modified, or flagged-for-removal.**
  They are the human's other concerns, not overture's. Overture's
  job is to add what's in the document, not to subtract what's not.

- **Settings conflicts are refused, not resolved.** If the canonical
  document says a server should be configured one way and a client
  has it configured another way, overture does not silently pick a
  winner. It reports the disagreement and exits. The human decides.

- **Every change is recoverable by `mv`.** Before overture writes to
  any file, a backup of the prior state exists at a known location
  adjacent to the file. The recovery path is a single command. This
  is non-negotiable.

- **The product never assumes network connectivity.** It does not
  phone home, fetch updates, or report telemetry. It reads and writes
  files on the local machine and stops.

- **The product never makes the human's setup worse without an
  explicit, visible confirmation step.** A misapplied intent is
  always a recoverable event. A silent corruption is not.

## Out of scope

The product does not implement these today, and there is no plan
that requires it to. They are listed so future questions can be
answered by pointing at this list.

- **Skills management.** The canonical-intent document has a section
  for skills because the format accommodates it, but overture does
  not read, install, update, or remove Agent Skills. A future
  version may; today's version does not.
- **Multi-user, team, or shared configurations.** One human, one
  machine. No concept of "the team's MCP setup."
- **A web UI, a desktop app, a TUI, or any interface other than the
  command line.** The command line is the interface.
- **Project-level or per-directory configuration.** The product
  operates on a single user-level document. It does not read or
  write `.overture.jsonc` files inside repositories.
- **Performance under a second, latency budgets, or any other
  quantitative response-time goal.** The product is expected to be
  fast enough to feel instant; it is not measured in milliseconds.
- **A plugin system, an extension API, or any way for third parties
  to add behaviors to the product.** The product's behaviors are
  the product.
- **Auto-discovery of "what MCPs are popular" or any
  recommendation-engine feature.** The human's intent is the only
  thing the product applies.

## What good looks like

Three moments that prove the product is working.

A developer installs a new client on their machine. They run one
command, see a preview of exactly what the product will write to the
client's configuration, say yes, and the MCP setup they already have
on their other clients is now there. Total time: under a minute.
Number of decisions made: zero, if the configuration is unambiguous.

A developer is about to wipe their laptop. They have a copy of the
canonical-intent document backed up somewhere safe. After the wipe,
they install the clients, run one command, and the setup is
restored. The clients do not need to be reinstalled in any
particular order. The product reads what is there and writes what
is missing.

A developer returns to their machine after eight months. They run
one command, see what overture thinks they have, and either confirm
it is what they want or edit the canonical-intent document to
reflect what they want now. The product does not surprise them with
auto-changes. The product does not get in their way.

In all three cases, the product is silent the rest of the time. The
developer is not reminded that overture exists. Overture is the
thing that is there when they need it and not there when they do
not.

## How this document is used

When implementation questions get hard, this document is the
reference. The behaviors and invariants are the contract. A
proposed change to the product is checked against this document:
does it serve one of the four behaviors? does it preserve the
invariants? if the answer to both is yes, the change is consistent
with the product; if not, either the change or this document is
wrong, and a human decides which.

When the implementation document is unclear about _why_ a decision
was made, this document is the why. The implementation document
describes _how_; this document describes _what_ and _why_.
