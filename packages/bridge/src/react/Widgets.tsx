import type { ConnectTheme } from "@apkaya/connect";
import { BuyFlow, type BuyFlowProps } from "./BuyFlow.js";

export interface WidgetThemeProps {
  theme?: ConnectTheme;
}

export function BuyWidget(props: Omit<BuyFlowProps, "mode"> & WidgetThemeProps) {
  const { theme: _theme, ...flowProps } = props;
  return <BuyFlow mode="buy" {...flowProps} />;
}

export function SwapWidget(props: Omit<BuyFlowProps, "mode"> & WidgetThemeProps) {
  const { theme: _theme, ...flowProps } = props;
  return <BuyFlow mode="swap" {...flowProps} />;
}

export interface CheckoutWidgetProps extends Omit<BuyFlowProps, "mode">, WidgetThemeProps {
  fiatAmount?: number;
  cryptoAmount?: string;
}

export function CheckoutWidget({ fiatAmount, cryptoAmount, theme: _theme, ...rest }: CheckoutWidgetProps) {
  return (
    <BuyFlow
      mode="checkout"
      fixedFiatAmount={fiatAmount}
      fixedCryptoAmount={cryptoAmount}
      {...rest}
    />
  );
}
