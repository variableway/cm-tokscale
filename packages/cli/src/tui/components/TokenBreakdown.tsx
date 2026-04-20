import { formatTokens, formatTokensCompact } from "../utils/format.js";

export interface TokenBreakdownData {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

interface TokenBreakdownProps {
  tokens: TokenBreakdownData;
  compact?: boolean;
  indent?: number;
}

export function TokenBreakdown(props: TokenBreakdownProps) {
  const indentStr = () => " ".repeat(props.indent ?? 0);

  if (props.compact) {
    return (
      <box flexDirection="row">
        <text fg="#666666">{indentStr()}</text>
        <text fg="#AAAAAA">{formatTokensCompact(props.tokens.input)}</text>
        <text fg="#666666">{"/"}</text>
        <text fg="#AAAAAA">{formatTokensCompact(props.tokens.output)}</text>
        <text fg="#666666">{"/"}</text>
        <text fg="#AAAAAA">{formatTokensCompact(props.tokens.cacheRead)}</text>
        <text fg="#666666">{"/"}</text>
        <text fg="#AAAAAA">{formatTokensCompact(props.tokens.cacheWrite)}</text>
      </box>
    );
  }

  return (
    <box flexDirection="row">
      <text fg="#666666">{`${indentStr()}In: `}</text>
      <text fg="#AAAAAA">{formatTokens(props.tokens.input)}</text>
      <text fg="#666666">{" · Out: "}</text>
      <text fg="#AAAAAA">{formatTokens(props.tokens.output)}</text>
      <text fg="#666666">{" · CR: "}</text>
      <text fg="#AAAAAA">{formatTokens(props.tokens.cacheRead)}</text>
      <text fg="#666666">{" · CW: "}</text>
      <text fg="#AAAAAA">{formatTokens(props.tokens.cacheWrite)}</text>
    </box>
  );
}
