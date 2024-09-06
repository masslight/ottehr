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

# Every time we add a new endpoint in serverless.yml we should dublicate it's name here, otherwise it will not be deployed
# Zip

ZIP_ORDER=('get-patients' 'get-providers' 'get-groups' 'get-locations' 'get-paperwork' 'create-paperwork' 'update-paperwork' 'update-appointment' 'create-appointment' 'get-appointments' 'get-schedule' 'cancel-appointment' 'get-wait-status' 'join-call' 'video-chat-invites-create' 'video-chat-invites-cancel' 'video-chat-invites-list' 'get-presigned-file-url' 'payment-methods-setup' 'payment-methods-list' 'payment-methods-set-default' 'payment-methods-delete')

for zip_file in .serverless/*.zip; do
    # Extract the function name from the zip file name
    function_name=$(basename "$zip_file" .zip)
    
    # Create a temporary directory for this function
    temp_dir=".dist/temp/$function_name"
    mkdir -p "$temp_dir"
    
    # Unzip the contents to the temporary directory
    unzip -q "$zip_file" -d "$temp_dir"
    
    # Create a new zip file in the .dist directory, preserving the directory structure
    (cd "$temp_dir" && zip -r "../../$function_name.zip" .)
    
    # Clean up the temporary directory
    rm -rf "$temp_dir"
done

# Clean up temp
# rm -r $DIST_DIR/temp

# Announce victory
echo ''
echo 'Zambda zips are ready to deploy from the .dist directory.'
