# FixLink Deployment Guide

This repository is configured with GitHub Actions to automatically deploy to Firebase Hosting. To enable this, you must set up the following secrets in your GitHub repository.

## 1. Setup Firebase Service Account
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Project Settings > Service Accounts.
3. Click "Generate new private key".
4. Copy the entire contents of the JSON file.

## 2. Add Secrets to GitHub
1. Go to your GitHub repository: `https://github.com/fixlinksa/fixlink`.
2. Settings > Secrets and variables > Actions.
3. Click "New repository secret" and add the following:

| Secret Name | Description |
| :--- | :--- |
| `FIREBASE_SERVICE_ACCOUNT_FIXLINK_A0AA2` | The full content of the Firebase Service Account JSON key. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Your Firebase API Key. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Your Firebase Auth Domain. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Your Firebase Project ID. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Your Firebase Storage Bucket. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Your Firebase Messaging Sender ID. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Your Firebase App ID. |
| `GMAIL_USER` | `fixlinksa@gmail.com` |
| `GMAIL_APP_PASSWORD` | `kljbvpfjioscsqmq` |

## 3. Automatic Deployment
Once these secrets are added, every push to the `main` branch will automatically build and deploy the latest version of FixLink to production.

---

> [!TIP]
> You can also run a manual deployment from your local machine using:
> `npm run deploy`
