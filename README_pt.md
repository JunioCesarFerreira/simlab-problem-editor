# simlab-problem-editor

🌍 *[English](README.md) ∙ [**Português**](README_pt.md)*

Editor visual para criação de instâncias de problemas de Redes de Sensores sem Fio (WSN — *Wireless Sensor Networks*) compatíveis com o pipeline de experimentação do [SimLab](https://github.com/JunioCesarFerreira/simlab).

**[Demo online](https://juniocesarferreira.github.io/simlab-problem-editor/)**

## Visão Geral

O **simlab-problem-editor** é um editor visual baseado em navegador, desenvolvido com **Vue 3**, **TypeScript** e **Pinia**, para criar instâncias de problemas de WSN no formato JSON esperado pelo **SimLab**.

A ferramenta foi projetada para simplificar a definição de cenários espaciais de rede, substituindo a escrita manual de JSON por um fluxo interativo em canvas. Em vez de editar coordenadas e expressões de trajetórias manualmente, é possível usar uma imagem de referência, definir a região do problema, posicionar o sink e os nós candidatos, desenhar trajetórias de nós móveis, criar cromossomos de solução e exportar artefatos JSON diretamente.

Isso é particularmente útil em cenários nos quais a estrutura espacial é importante, como layouts urbanos sintéticos, áreas industriais monitoradas ou experimentos de comunicação com mobilidade.

## O que o editor faz

Com o **simlab-problem-editor**, você pode:

- carregar uma imagem de fundo como referência espacial
- calibrar a escala do canvas para coordenadas do mundo real
- definir a região do problema
- posicionar e editar manualmente a posição do nó sink
- posicionar e editar candidatos a nós fixos
- posicionar e editar alvos em instâncias orientadas a cobertura
- projetar visualmente trajetórias de nós móveis
- criar e exportar cromossomos de solução para `problem1` até `problem4`
- inspecionar o alcance de comunicação por meio de sobreposições de conectividade gerais e baseadas no cromossomo
- medir distâncias diretamente na cena
- exportar instâncias de problema e cromossomos como JSON compatível com o SimLab

A saída exportada foi pensada para ser consumida pelos componentes de otimização e simulação do SimLab.

## Principais Funcionalidades

- **Suporte a imagem de fundo**  
  Importe um mapa, planta, croqui ou qualquer outra imagem para servir como referência geométrica do cenário.

- **Calibração em coordenadas do mundo real**  
  Defina a escala por meio de um segmento de comprimento conhecido, de modo que todas as posições sejam convertidas consistentemente para coordenadas do mundo real.

- **Definição da região**  
  Especifique a caixa delimitadora do cenário no formato `[xmin, ymin, xmax, ymax]`.

- **Posicionamento do sink**  
  Insira exatamente um nó sink na instância do problema e edite suas coordenadas manualmente em `problem1`, `problem2` e `problem3`.

- **Posicionamento de nós candidatos**  
  Adicione, mova e remova posições candidatas para nós fixos de comunicação.

- **Posicionamento de alvos para cenários de cobertura**  
  Adicione, mova e remova pontos-alvo ao criar instâncias `problem3`.

- **Construção de trajetórias móveis**  
  Desenhe trajetórias para nós móveis usando:
  - **Segmentos polilineares**
  - **Trajetórias elípticas**

- **Geração automática de trajetórias paramétricas**  
  Converta trajetórias definidas visualmente em expressões paramétricas adequadas para o processamento posterior no SimLab.

- **Visualização do grafo de conectividade**  
  Exiba arestas entre nós que estejam dentro do raio de comunicação.

- **Criação de cromossomos**  
  Crie cromossomos de solução com:
  - `problem1`: coordenadas dos relays e protocolo MAC
  - `problem2` / `problem3`: máscara de ativação dos candidatos e protocolo MAC
  - `problem4`: rota por candidatos, tempos de permanência e protocolo MAC

- **Sobreposição de conectividade do cromossomo**  
  Inspecione a conectividade considerando apenas os nós implantados pelo cromossomo atual.

- **Ferramenta de medição**  
  Meça distâncias em unidades calibradas diretamente no canvas.

- **Pré-visualização JSON em tempo real**  
  Inspecione a instância gerada em tempo real durante a edição.

- **Exportação para JSON**  
  Gere um objeto válido no formato `{ "problem": { ... } }` e, quando necessário, um objeto JSON separado para o cromossomo, prontos para uso em fluxos do SimLab.

## Fluxo típico de uso

1. Carregue uma imagem de referência.
2. Calibre a escala da imagem.
3. Defina a região do cenário.
4. Posicione o nó sink.
5. Adicione as posições candidatas de nós fixos.
6. Adicione pontos-alvo ao usar um tipo de problema orientado a cobertura.
7. Desenhe as trajetórias dos nós móveis.
8. Crie um cromossomo na aba **Chromosome** quando quiser definir uma solução.
9. Inspecione conectividade, conectividade do cromossomo e distâncias.
10. Exporte o JSON do problema e o JSON do cromossomo.

Esse fluxo facilita a construção de cenários reprodutíveis de WSN sem a necessidade de derivar manualmente coordenadas e expressões de trajetória.

## Atalhos de Teclado

| Tecla | Ação |
|------|------|
| `S` | Ferramenta de seleção |
| `K` | Posicionar sink |
| `C` | Posicionar candidato |
| `T` | Posicionar alvo (`problem3`) |
| `N` | Posicionar relay para cromossomo de `problem1` |
| `X` | Escolher nós do cromossomo: alternar máscara em `problem2` / `problem3`, adicionar parada de rota em `problem4` |
| `L` | Desenhar linha / segmento polilinear |
| `E` | Desenhar elipse |
| `M` | Medir distância |
| `R` | Calibrar escala |
| `G` | Alternar visualização do grafo de conectividade |
| `H` | Alternar visualização do grafo de conectividade do cromossomo |
| `Del` | Remover elemento selecionado |
| `Esc` | Cancelar desenho atual |

## Formato de Saída

O editor exporta JSON seguindo o esquema de problema do SimLab. Os campos exatos dependem do tipo de problema selecionado:

| Tipo de problema | Campos de posicionamento |
| ---------------- | ------------------------ |
| `problem1` | `number_of_relays` |
| `problem2` | `candidates` |
| `problem3` | `candidates`, `targets`, `radius_of_cover`, `k_required` |
| `problem4` | `candidates` |

Exemplo:

```json
{
  "problem": {
    "name": "problem3",
    "radius_of_reach": 100,
    "radius_of_inter": 200,
    "radius_of_cover": 90,
    "k_required": 1,
    "region": [-150, -150, 150, 150],
    "sink": [0, 0],
    "candidates": [[-50, 0], [50, 0]],
    "targets": [[0, 75]],
    "mobile_nodes": [
      {
        "name": "node1",
        "source_code": "node.c",
        "speed": 5,
        "time_step": 1,
        "is_closed": true,
        "is_round_trip": false,
        "path_segments": [
          [
            "cx + rx * np.cos(2 * np.pi * t)",
            "cy + ry * np.sin(2 * np.pi * t)"
          ]
        ]
      }
    ]
  }
}
```

### Observações sobre as expressões de trajetória

* Cada segmento de trajetória é representado de forma paramétrica com `t ∈ [0, 1]`.
* As expressões podem usar `np.cos`, `np.sin` e `np.pi`.
* O formato gerado é compatível com o processamento baseado em NumPy utilizado no SimLab.
* Segmentos importados são preservados como expressões paramétricas customizadas.

## Formato de Saída do Cromossomo

Cromossomos são exportados separadamente das instâncias de problema. A saída contém o `problem_name` selecionado e um objeto `chromosome` cujo formato depende do tipo de problema:

| Tipo de problema | Campos do cromossomo |
| ---------------- | -------------------- |
| `problem1` | `mac_protocol`, `relays` |
| `problem2` | `mac_protocol`, `mask` |
| `problem3` | `mac_protocol`, `mask` |
| `problem4` | `mac_protocol`, `route`, `sojourn_times` |

`mac_protocol` é exportado como `0` para CSMA/CA e `1` para TSCH.

Exemplo:

```json
{
  "problem_name": "problem4",
  "chromosome": {
    "mac_protocol": 1,
    "route": [0, 2, 1],
    "sojourn_times": [10, 5, 12]
  }
}
```

## Tecnologias Utilizadas

| Camada                  | Tecnologia              |
| ----------------------- | ----------------------- |
| Framework               | Vue 3 (Composition API) |
| Linguagem               | TypeScript              |
| Gerenciamento de Estado | Pinia                   |
| Renderização            | HTML5 Canvas 2D         |
| Build Tool              | Vite                    |

## Primeiros Passos

### Instalação das dependências

```bash
npm install
```

### Execução em modo de desenvolvimento

```bash
npm run dev
```

### Build para produção

```bash
npm run build
```

## Estrutura do Projeto

```text
src/
  components/
    editor/
      ProblemEditor.vue      # Layout principal do editor
      CanvasView.vue         # Renderização do canvas e lógica de interação
      Toolbar.vue            # Botões de ferramentas e ações do editor
      PropertiesPanel.vue    # Propriedades editáveis do elemento selecionado
      JsonPreviewPanel.vue   # Visualização JSON em tempo real
    problem/
      ChromosomePanel.vue    # Dispatcher do editor de cromossomos
      ChromosomeP1Panel.vue  # Editor de cromossomo baseado em relays
      ChromosomeMaskPanel.vue # Editor de máscara para problem2/problem3
      ChromosomeP4Panel.vue  # Editor de rota e tempos de permanência
  stores/
    problemStore.ts          # Estado do modelo do problema e lógica de exportação
    editorStore.ts           # Estado da interface, ferramenta ativa, viewport e overlays
  models/
    problem.ts               # Tipos e interfaces de domínio
  services/
    exportProblemJson.ts     # Conversão do estado do editor para JSON do SimLab
    exportChromosomeJson.ts  # Conversão do cromossomo para JSON do SimLab
    importProblemJson.ts     # Importação de JSON de problema existente
```

## Casos de Uso

Este editor é útil para:

* prototipagem rápida de cenários de WSN
* experimentos de projeto de rede com mobilidade
* preparação de instâncias de benchmark para pipelines de otimização
* geração de entradas de problema para avaliação baseada em simulação
* definição visual de cenários estruturados a partir de mapas ou imagens de layout

## Repositórios Relacionados

* [SimLab](https://github.com/JunioCesarFerreira/simlab) — pipeline de experimentação, simulação e otimização
* [wsn-design-space-exploration](https://github.com/JunioCesarFerreira/wsn-design-space-exploration) — framework para exploração do espaço de projeto com MILP e otimização multiobjetivo
* [Cooja-MO-SimLab](https://github.com/JunioCesarFerreira/Cooja-MO-SimLab) — protótipo inicial do SimLab baseado em Cooja

## Licença

Este projeto está licenciado sob a **MIT License**.
