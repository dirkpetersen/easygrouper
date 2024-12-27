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
            const selectedGroupSection = document.getElementById('selectedGroupSection');
            if (groups.length === 0) {
                resultsDiv.innerHTML = '<div class="alert alert-info">No groups found</div>';
                selectedGroupSection.style.display = 'none';
            } else {
                selectedGroupSection.style.display = 'block';
                resultsDiv.innerHTML = groups.map(group => {
                    let memberDisplay;
                    if (group.members.length === 0) {
                        memberDisplay = 'None';
                    } else {
                        const displayedMembers = group.members.slice(0, 10);
                        const remainingCount = group.members.length - 10;
                        memberDisplay = displayedMembers.join(', ');
                        if (remainingCount > 0) {
                            memberDisplay += ` ... and ${remainingCount} more members`;
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
        label.textContent = 'Please click on a card to select';
    }
}

function updateAddRemoveTab() {
    const addremoveMessage = document.getElementById('addremoveMessage');
    const memberManagement = document.getElementById('memberManagement');
    const nonMembersList = document.getElementById('nonMembersList');
    const currentMembersList = document.getElementById('currentMembersList');

    if (!selectedGroup) {
        addremoveMessage.style.display = 'block';
        memberManagement.style.display = 'none';
        return;
    }

    addremoveMessage.style.display = 'none';
    memberManagement.style.display = 'block';

    // Get current group members
    fetch(`/api/groups/search?q=${encodeURIComponent(selectedGroup.id)}`)
        .then(response => response.json())
        .then(groups => {
            const group = groups.find(g => g.id === selectedGroup.id);
            if (!group) return;

            const currentMembers = group.members;
            
            if (selectedUsers.size > 0) {
                // Get all selected users
                const allSelectedUsers = Array.from(selectedUsers).map(id => {
                    const userCard = document.querySelector(`.user-card[onclick*="${id}"]`);
                    if (userCard) {
                        return {
                            id: id,
                            name: userCard.querySelector('strong').textContent
                        };
                    }
                    return null;
                }).filter(user => user);

                // Split users into members and non-members
                const members = allSelectedUsers.filter(user => currentMembers.includes(user.id));
                const nonMembers = allSelectedUsers.filter(user => !currentMembers.includes(user.id));

                // Update non-members list
                nonMembersList.innerHTML = nonMembers.map(user => `
                    <div class="user-item mb-2">
                        <span>${user.name}</span>
                        <button class="btn btn-sm btn-success" onclick="addMember('${user.id}')">Add to Group</button>
                    </div>
                `).join('') || '<p>No non-members selected</p>';

                // Update current members list
                currentMembersList.innerHTML = members.map(user => `
                    <div class="user-item mb-2">
                        <span>${user.name}</span>
                        <button class="btn btn-sm btn-danger" onclick="removeMember('${user.id}')">Remove from Group</button>
                    </div>
                `).join('') || '<p>No current members selected</p>';
            } else {
                // Show all current members (up to 25) when no users are selected
                nonMembersList.innerHTML = '<p>Select users to add them to the group</p>';
                
                // Pagination logic
                const itemsPerPage = 20; // 10 items per column * 2 columns
                const currentPage = parseInt(currentMembersList.dataset.currentPage || '1');
                const totalPages = Math.ceil(currentMembers.length / itemsPerPage);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                
                // Get current page members
                const displayMembers = currentMembers.slice(startIndex, endIndex);
                
                // Split into two columns
                const column1 = displayMembers.slice(0, 10);
                const column2 = displayMembers.slice(10);
                
                currentMembersList.innerHTML = `
                    <div class="members-grid">
                        <div class="members-column">
                            ${column1.map(memberId => `
                                <div class="user-item mb-2">
                                    <span>${memberId}</span>
                                    <button class="btn btn-sm btn-danger" onclick="removeMember('${memberId}')">Remove from Group</button>
                                </div>
                            `).join('')}
                        </div>
                        <div class="members-column">
                            ${column2.map(memberId => `
                                <div class="user-item mb-2">
                                    <span>${memberId}</span>
                                    <button class="btn btn-sm btn-danger" onclick="removeMember('${memberId}')">Remove from Group</button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ${totalPages > 1 ? `
                        <div class="pagination-controls mt-3">
                            <button class="btn btn-secondary" 
                                    onclick="changeMembersPage(${currentPage - 1})"
                                    ${currentPage === 1 ? 'disabled' : ''}>
                                Previous
                            </button>
                            <span class="mx-3">Page ${currentPage} of ${totalPages}</span>
                            <button class="btn btn-secondary" 
                                    onclick="changeMembersPage(${currentPage + 1})"
                                    ${currentPage === totalPages ? 'disabled' : ''}>
                                Next
                            </button>
                        </div>
                    ` : ''}
                `;
                currentMembersList.dataset.currentPage = currentPage;
            }
        });
}

function addMember(userId) {
    if (!selectedGroup) return;
    
    fetch('/api/submit-changes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            users: [userId],
            group: selectedGroup.id
        })
    })
    .then(response => response.json())
    .then(() => {
        updateAddRemoveTab();
    })
    .catch(error => {
        alert('Error adding member');
        console.error('Error:', error);
    });
}

function changeMembersPage(newPage) {
    const currentMembersList = document.getElementById('currentMembersList');
    currentMembersList.dataset.currentPage = newPage;
    updateAddRemoveTab();
}

function removeMember(userId) {
    if (!selectedGroup) return;
    
    fetch('/api/submit-changes', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            users: [userId],
            group: selectedGroup.id
        })
    })
    .then(response => response.json())
    .then(() => {
        updateAddRemoveTab();
    })
    .catch(error => {
        alert('Error removing member');
        console.error('Error:', error);
    });
}

// Initialize Bootstrap tabs
document.addEventListener('DOMContentLoaded', function() {
    var triggerTabList = [].slice.call(document.querySelectorAll('#mainTabs button'));
    triggerTabList.forEach(function(triggerEl) {
        triggerEl.addEventListener('shown.bs.tab', function (event) {
            if (event.target.id === 'addremove-tab') {
                updateAddRemoveTab();
            }
        });
        new bootstrap.Tab(triggerEl);
    });
});
