declare module 'troika-flex-layout' {
  /**
   * Layout result for a single flex node.
   */
  export interface FlexLayoutResultNode {
    /** The node's computed left position */
    left: number
    /** The node's computed top position */
    top: number
    /** The node's computed width */
    width: number
    /** The node's computed height */
    height: number
  }

  /**
   * Mapping of node ids to layout results.
   */
  export interface FlexLayoutResult {
    [nodeId: string]: FlexLayoutResultNode
  }

  /**
   * Parameters for the measureFunction.
   */
  export interface MeasureFunctionParams {
    text: string
    font: string
    fontSize: number
    lineHeight: number
    letterSpacing: number
    whiteSpace: string
    overflowWrap: string
    maxWidth: number
  }

  /**
   * Style node for flexbox layout.
   */
  export interface FlexLayoutStyleNode {
    id: string
    text?: string
    font?: string
    fontSize?: number
    lineHeight?: number
    letterSpacing?: number
    whiteSpace?: string
    overflowWrap?: string
    width?: number
    height?: number
    minWidth?: number
    minHeight?: number
    maxWidth?: number
    maxHeight?: number
    aspectRatio?: number
    flexDirection?: 'column' | 'column-reverse' | 'row' | 'row-reverse'
    flex?: number
    flexWrap?: 'nowrap' | 'wrap'
    flexBasis?: number
    flexGrow?: number
    flexShrink?: number
    alignContent?:
      | 'auto'
      | 'baseline'
      | 'center'
      | 'flex-end'
      | 'flex-start'
      | 'stretch'
    alignItems?:
      | 'auto'
      | 'baseline'
      | 'center'
      | 'flex-end'
      | 'flex-start'
      | 'stretch'
    alignSelf?:
      | 'auto'
      | 'baseline'
      | 'center'
      | 'flex-end'
      | 'flex-start'
      | 'stretch'
    justifyContent?:
      | 'center'
      | 'flex-end'
      | 'flex-start'
      | 'space-around'
      | 'space-between'
    position?: 'absolute' | 'relative'
    top?: number
    right?: number
    bottom?: number
    left?: number
    marginTop?: number
    marginRight?: number
    marginBottom?: number
    marginLeft?: number
    paddingTop?: number
    paddingRight?: number
    paddingBottom?: number
    paddingLeft?: number
    borderTop?: number
    borderRight?: number
    borderBottom?: number
    borderLeft?: number
    children?: FlexLayoutStyleNode[]
  }

  /**
   * Main entry point. This issues a request to the web worker to perform flexbox layout
   * on the given styleTree, calling the callback function with the results when finished.
   */
  export function requestFlexLayout(
    styleTree: FlexLayoutStyleNode,
    callback: (result: FlexLayoutResult) => void,
  ): void
}
