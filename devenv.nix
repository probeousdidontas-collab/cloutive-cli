{ pkgs, lib, config, inputs, ... }:

{
  packages = [ pkgs.git ];
  languages.typescript.enable = true;
  languages.javascript = {
    enable = true;
    bun.enable = true;
  };
}
