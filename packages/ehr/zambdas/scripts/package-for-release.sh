# Where this script is located (https://stackoverflow.com/a/246128)
SCRIPTS_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Clean and set up base directories
rm -r $SCRIPTS_DIR/../.dist
mkdir -p $SCRIPTS_DIR/../.dist
mkdir -p $SCRIPTS_DIR/../.dist/temp

# Where `serverless package` puts deployment artifacts
SLS_DIR=$(realpath $SCRIPTS_DIR/../.serverless)
# Where we will build and place deployable zips
DIST_DIR=$(realpath $SCRIPTS_DIR/../.dist)

# Zip
ZIP_ORDER=("version" "deactivate-user" "save-followup-encounter" "get-appointments" "get-telemed-appointments" "change-telemed-appointment-status" "assign-practitioner" "unassign-practitioner" "get-conversation" "get-employees" "update-user" "get-user" "init-telemed-session" "save-chart-data" "get-chart-data" "delete-chart-data" "save-patient-instruction" "get-patient-instructions" "delete-patient-instruction" "notifications-updater" "sync-user" "icd-search" "communication-subscription" "process-erx-resources" "telemed-appointment-subscription" "get-claims" "get-patient-profile-photo-url" "create-update-medication-order" "get-medication-orders" "create-upload-document-url" "sign-appointment" "get-chart-data-versioned")

for ZAMBDA in ${ZIP_ORDER[@]}; do
  # Set up temp directory for the zip
  mkdir -p "$DIST_DIR/temp/$ZAMBDA"
  # Unzip into temp
  unzip "$SLS_DIR/$ZAMBDA.zip" -d "$DIST_DIR/temp/$ZAMBDA"
  # Make deployable zip in .dist
  zip -jr "$DIST_DIR/$ZAMBDA.zip" "$DIST_DIR/temp/$ZAMBDA"
done

# Clean up temp
rm -r $DIST_DIR/temp

# Announce victory
echo ''
echo 'Zambda zips are ready to deploy from the .dist directory.'