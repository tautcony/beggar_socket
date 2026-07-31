export function readFileAsArrayBuffer(file: File, signal?: AbortSignal): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let settled = false;

    const cleanup = () => {
      signal?.removeEventListener('abort', abortRead);
    };
    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };
    function abortRead() {
      if (reader.readyState === FileReader.LOADING) {
        reader.abort();
        return;
      }
      settle(() => {
        reject(new DOMException(`Reading ${file.name} was aborted`, 'AbortError'));
      });
    }

    if (signal?.aborted) {
      abortRead();
      return;
    }
    signal?.addEventListener('abort', abortRead, { once: true });

    reader.onload = () => {
      settle(() => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
          return;
        }
        reject(new Error(`Failed to read ${file.name}: unexpected FileReader result`));
      });
    };
    reader.onerror = () => {
      settle(() => {
        reject(reader.error ?? new Error(`Failed to read ${file.name}`));
      });
    };
    reader.onabort = () => {
      settle(() => {
        reject(new DOMException(`Reading ${file.name} was aborted`, 'AbortError'));
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  let url: string | null = null;
  let anchor: HTMLAnchorElement | null = null;

  try {
    url = URL.createObjectURL(blob);
    anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    if (anchor?.parentNode) {
      anchor.parentNode.removeChild(anchor);
    }
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}
