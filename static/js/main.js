let selectedUsers = new Set();
let selectedGroup = null;

function searchUsers() {
    const query = document.getElementById('userSearchInput').value;
    const spinner = document.getElementById('userSpinner');
    const results = document.getElementById('userSearchResults');
    
    spinner.style.display = 'block';
    results.style.display = 'none';
    
    fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(users => {
            const resultsDiv = document.getElementById('userSearchResults');
            const selectedUsersSection = document.getElementById('selectedUsersSection');
            if (users.length === 0) {
                resultsDiv.innerHTML = '<div class="alert alert-info">No users found</div>';
                selectedUsersSection.style.display = 'none';
            } else {
                selectedUsersSection.style.display = 'block';
                resultsDiv.innerHTML = users.map(user => `
                <div class="user-card ${selectedUsers.has(user.id) ? 'selected' : ''}" 
                     onclick="toggleUser('${user.id}')">
                    <p><strong>${user.name || ''} (${user.id || ''})</strong><br>
                    ${user.email || ''}<br>
                    ${user.jobtitle || ''}<br>
                    ${user.department || ''}</p>
                </div>
            `).join('');
            }
            spinner.style.display = 'none';
            results.style.display = 'grid';
        })
        .catch(error => {
            console.error('Error:', error);
            spinner.style.display = 'none';
            results.style.display = 'grid';
        });
}

function searchGroups() {
    const query = document.getElementById('groupSearchInput').value;
    const spinner = document.getElementById('groupSpinner');
    const results = document.getElementById('groupSearchResults');
    
    spinner.style.display = 'block';
    results.style.display = 'none';
    
    fetch(`/api/groups/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(groups => {
            const resultsDiv = document.getElementById('groupSearchResults');
            if (groups.length === 0) {
                resultsDiv.innerHTML = '<div class="alert alert-info">No groups found</div>';
            } else {
                resultsDiv.innerHTML = groups.map(group => {
                    let memberDisplay;
                    if (group.members.length === 0) {
                        memberDisplay = 'None';
                    } else {
                        const displayedMembers = group.members.slice(0, 10);
                        const remainingCount = group.members.length - 10;
                        memberDisplay = displayedMembers.join(', ');
                        if (remainingCount > 0) {
                            memberDisplay += ` and ${remainingCount} more members`;
                        }
                    }
                    return `
                        <div class="group-card ${selectedGroup?.id === group.id ? 'selected' : ''}"
                             onclick="selectGroup('${group.id}', '${group.name}')">
                            <h5>${group.name}</h5>
                            <p>Members: ${memberDisplay}</p>
                        </div>
                    `;
                }).join('');
            }
            spinner.style.display = 'none';
            results.style.display = 'grid';
        })
        .catch(error => {
            console.error('Error:', error);
            spinner.style.display = 'none';
            results.style.display = 'grid';
        });
}

function toggleUser(id) {
    if (selectedUsers.has(id)) {
        selectedUsers.delete(id);
    } else {
        selectedUsers.add(id);
    }
    updateSelectedUsers();
    // Update the clicked card's selected state
    const selectedCard = document.querySelector(`.user-card[onclick*="${id}"]`);
    if (selectedCard) {
        selectedCard.classList.toggle('selected');
    }
}

function selectGroup(id, name) {
    selectedGroup = { id, name };
    updateSelectedGroup();
    document.querySelectorAll('.group-card').forEach(card => {
        card.classList.remove('selected');
        if (card.onclick.toString().includes(`${id}`)) {
            card.classList.add('selected');
        }
    });
}

function updateSelectedUsers() {
    const container = document.getElementById('selectedUsers');
    container.innerHTML = Array.from(selectedUsers).map(id => {
        return `
            <span class="selected-item">
                ${id}
                <span class="remove-btn" onclick="toggleUser('${id}')">×</span>
            </span>
        `;
    }).join('');
    
    // Update recipients textarea
    updateRecipients();
}

function updateRecipients() {
    const recipientsArea = document.getElementById('recipientsArea');
    if (!recipientsArea) return;

    const emails = Array.from(selectedUsers).map(id => {
        const userCard = document.querySelector(`.user-card[onclick*="${id}"]`);
        if (userCard) {
            const emailElement = userCard.querySelector('p');
            const emailText = emailElement.textContent.split('\n')[0];
            // Extract just the email part before any parentheses
            const email = emailText.split(' (')[0].trim();
            return email;
        }
        return null;
    }).filter(email => email);

    recipientsArea.value = emails.join('; ');
}

function copyRecipients() {
    const recipientsArea = document.getElementById('recipientsArea');
    recipientsArea.select();
    document.execCommand('copy');
    // Deselect the text
    window.getSelection().removeAllRanges();
    
    // Optional: Show feedback
    const button = document.querySelector('[onclick="copyRecipients()"]');
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => {
        button.textContent = originalText;
    }, 2000);
}

function updateSelectedGroup() {
    const label = document.getElementById('selectedGroupLabel');
    if (selectedGroup) {
        label.textContent = selectedGroup.name;
    } else {
        label.textContent = 'None selected';
    }
}

function submitChanges() {
    if (selectedUsers.size === 0 || !selectedGroup) {
        alert('Please select both users and a group before submitting');
        return;
    }

    const changes = {
        users: Array.from(selectedUsers),
        group: selectedGroup.id
    };

    fetch('/api/submit-changes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(changes)
    })
    .then(response => response.json())
    .then(result => {
        alert('Changes submitted successfully!');
        // Clear selections
        selectedUsers.clear();
        selectedGroup = null;
        updateSelectedUsers();
        updateSelectedGroup();
        // Reset search results
        document.getElementById('userSearchResults').innerHTML = '';
        document.getElementById('groupSearchResults').innerHTML = '';
    })
    .catch(error => {
        alert('Error submitting changes');
        console.error('Error:', error);
    });
}

// Initialize Bootstrap tabs
document.addEventListener('DOMContentLoaded', function() {
    var triggerTabList = [].slice.call(document.querySelectorAll('#mainTabs button'));
    triggerTabList.forEach(function(triggerEl) {
        new bootstrap.Tab(triggerEl);
    });
});
