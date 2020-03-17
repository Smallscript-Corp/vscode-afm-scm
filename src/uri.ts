/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ben Crowl. All rights reserved.
 *  Original Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Uri } from 'vscode';

export function fromAfmUri(uri: Uri): { path: string} {
    return JSON.parse(uri.query);
}

export function toAfmUri(uri: Uri): Uri {
    return uri.with({
        scheme: 'afm-original',
        path: uri.path,
        query: JSON.stringify({
            path: uri.fsPath
        })
    });
}
