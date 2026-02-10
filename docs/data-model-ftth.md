# Data Model FTTH (Frontend Ready for Backend)

## Hierarquia

`Project -> City -> POP -> Node -> Port -> Fiber/Core`

- `Project`: container principal de planejamento.
- `City`: agrupamento geográfico dentro do projeto.
- `POP`: ponto de presença da cidade.
- `Node`: equipamentos e caixas (`OLT`, `DIO`, `CEO`, `CTO`, `CLIENTE`).
- `Port`: entradas/saídas físicas de cada nó.
- `Fiber/Core`: caminho óptico e fibras individuais dos cabos.

## Campos de Escopo (multi-tenant lógico)

Todos os objetos de rede devem carregar:

- `projectId`
- `city`
- `pop`

Isso permite:

- filtrar visualização por projeto/cidade/pop;
- particionar dados no backend sem ambiguidade;
- escalar com índices compostos.

## Índices recomendados no backend

Para coleções de `fibers`, `nodes`, `clients`:

- `(projectId, city, pop)`
- `(projectId, city)`
- `(projectId)`

Para rastreio operacional:

- `nodeId`, `portId`, `cableId`, `fiberId`

## Regras de consistência

- `projectId/city/pop` de novos elementos devem vir do contexto ativo da UI.
- `OUT` e `IN` conectam apenas cabos existentes no mesmo escopo lógico.
- fusões devem ser registradas com referências explícitas de porta/fibra.
- splitters devem manter referência de entrada e saídas por perna.

## Próximo passo de integração

1. Criar endpoints `projects`, `cities`, `pops`.
2. Persistir `fibers` e `nodes` com `projectId/city/pop`.
3. Persistir operações de fusão/splitter como eventos ou snapshots versionados.
