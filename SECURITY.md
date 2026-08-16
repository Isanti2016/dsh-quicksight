# Security

## Credentials

dsh-quicksight stores no credentials. Tier-2 vision reading relies on the
modlens configuration at `~/.modlens/config.json` (API keys live there, never
in this repository or in session logs).

## Data handling

- **Tier-1 (RapidOCR)**: fully local — images and extracted text never leave
  the machine.
- **Tier-2 (vision model)**: the image is sent to the vision engine configured
  in modlens (e.g. Nvidia NIM, Gemini, any OpenAI-compatible endpoint). Do not
  point tier-2 at an engine you do not trust with your image contents.

## Reporting

Please report security issues privately by opening a GitHub issue with the
"security" label on https://github.com/Isanti2016/dsh-quicksight.
