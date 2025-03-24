# Where this script is located (https://stackoverflow.com/a/246128)
SCRIPTS_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Clean and set up base directories
rm -r $SCRIPTS_DIR/../../.dist
mkdir -p $SCRIPTS_DIR/../../.dist
mkdir -p $SCRIPTS_DIR/../../.dist/temp

# Where `serverless package` puts deployment artifacts
SLS_DIR=$(realpath $SCRIPTS_DIR/../../.serverless)
# Where we will build and place deployable zips
DIST_DIR=$(realpath $SCRIPTS_DIR/../../.dist)

# Zip
ZIP_ORDER=('version' 'deactivate-user' 'save-followup-encounter' 'get-appointments' 'get-telemed-appointments' 'change-telemed-appointment-status' 'change-in-person-visit-status' 'assign-practitioner' 'unassign-practitioner' 'get-conversation' 'get-employees' 'update-user' 'get-user' 'init-telemed-session' 'save-chart-data' 'get-chart-data' 'delete-chart-data' 'save-patient-instruction' 'get-patient-instructions' 'delete-patient-instruction' 'notifications-updater' 'sync-user' 'icd-search' 'communication-subscription' 'process-erx-resources' 'telemed-appointment-subscription' 'get-claims' 'get-patient-profile-photo-url' 'create-update-medication-order' 'get-medication-orders' 'create-upload-document-url' 'sign-appointment' 'create-lab-order' 'paperwork-to-pdf' 'cancel-appointment' 'check-in' 'get-schedule' 'get-presigned-file-url' 'update-paperwork-in-progress' 'patch-paperwork' 'submit-paperwork' 'create-appointment' 'intake-get-appointments' 'get-patients' 'get-paperwork' 'update-appointment' 'send-message-cron' 'sub-cancellation-email' 'get-appointment-details' 'sub-intake-harvest' 'sub-check-in-text' 'sub-ready-text' 'sub-update-appointments' 'sub-confirmation-messages' 'payment-methods-list' 'payment-methods-delete' 'payment-methods-setup' 'payment-methods-set-default' 'video-chat-invites-cancel' 'video-chat-invites-create' 'video-chat-invites-list' 'get-visit-details' 'get-eligibility' 'get-answer-options' 'get-telemed-states' 'get-wait-status' 'join-call' 'telemed-cancel-appointment' 'telemed-create-appointment' 'get-past-visits' 'telemed-get-appointments' 'telemed-update-appointment' 'telemed-get-patients' 'list-bookables' 'get-patient-account' 'update-patient-account' 'remove-patient-coverage')

for ZAMBDA in ${ZIP_ORDER[@]}; do
  # Set up temp directory for the zip
  mkdir -p "$DIST_DIR/temp/$ZAMBDA"
  # Unzip into temp
  unzip "$SLS_DIR/$ZAMBDA.zip" -d "$DIST_DIR/temp/$ZAMBDA"
done

# Upload to Sentry only if we have AUTH_TOKEN for the environment. AUTH_TOKEN is used automatically by sentry-cli.
if [ ! -z "$SENTRY_AUTH_TOKEN" ]; then
    echo 'Uploading sourcemaps to Sentry...'
    sentry-cli sourcemaps inject $DIST_DIR/temp
    sentry-cli sourcemaps upload $DIST_DIR/temp
fi

# Clean up the folders before zipping
for ZAMBDA in ${ZIP_ORDER[@]}; do
  # Move js files to top of the folder for packaging
  find "$DIST_DIR/temp/$ZAMBDA/src" -name '*.js' -exec mv {} "$DIST_DIR/temp/$ZAMBDA" \;
  # Delete the src dir as we do not need it in the zip
  rm -r "$DIST_DIR/temp/$ZAMBDA/src"
done

echo 'Deleting sourcemaps and re-packaging...'
find $DIST_DIR/temp -name '*.js.map' -delete

# Make deployable zip in .dist
for ZAMBDA in ${ZIP_ORDER[@]}; do
  cd "$DIST_DIR/temp/$ZAMBDA"
  zip -r "$DIST_DIR/$ZAMBDA.zip" .
done
# Clean up temp
rm -r $DIST_DIR/temp

# Announce victory
echo ''
echo 'Zambda zips are ready to deploy from the .dist directory.'